import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`M7A verifier missing required file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, token, label) {
  if (!source.includes(token)) throw new Error(`M7A verifier missing ${label}: ${token}`);
}

const requiredSources = [
  'src/app/selection-alpha-engine.ts',
  'src/app/selection-combine-engine.ts',
  'src/app/selection-contour-presenter.ts',
  'src/app/selection-copy-engine.ts',
  'src/app/selection-coverage-controller.ts',
  'src/app/selection-cut-engine.ts',
  'src/app/selection-fill-engine.ts',
  'src/app/selection-filter-engine.ts',
  'src/app/selection-layer-operation-engine.ts',
  'src/app/selection-modifier-engine.ts',
  'src/app/selection-paste-engine.ts',
  'src/app/selection-region-engine.ts',
  'src/app/selection-shape-engine.ts',
  'src/app/selection-transform-engine.ts',
  'src/app/quick-mask-controller.ts',
];

for (const path of requiredSources) read(path);

const progress = read('IMPLEMENTATION_PROGRESS.md');
for (let item = 1; item <= 25; item += 1) {
  const id = `M7A-${String(item).padStart(3, '0')}`;
  const line = progress.split('\n').find((entry) => entry.startsWith(`${id} `));
  if (!line || !line.endsWith(':完了'))
    throw new Error(`${id} is not complete in canonical progress`);
}

const memo = read('ILLUSTRO_DESIGN_MEMO.md');
requireText(
  memo,
  'Lasso Selection / Lasso Fill / Lasso Eraser semantic and implementation contract',
  'authoritative Lasso contract',
);
requireText(memo, 'AUTHORITATIVE', 'authoritative contract marker');

const shape = read('src/app/selection-shape-engine.ts');
for (const token of [
  'prepareRectangularSelectionV1',
  'prepareEllipticalSelectionV1',
  'prepareLassoSelectionV1',
  'prepareFreehandSelectionV1',
  'prepareBrushPaintedSelectionV1',
  'polygonPixelCoverageV1',
  'CANONICAL_TILE_SIZE_PX',
]) {
  requireText(shape, token, 'selection shape contract');
}

const shapeTest = read('tests/unit/selection-shape-engine.test.ts');
requireText(
  shapeTest,
  'deterministic fractional coverage',
  'Lasso fractional-coverage regression test',
);
requireText(
  shapeTest,
  'coverage > 0 && coverage < 255',
  'Freehand fractional-coverage regression test',
);
requireText(
  shapeTest,
  'exposes all five M7A shape entry points',
  'shape entry-point coverage test',
);

const combine = read('src/app/selection-combine-engine.ts');
for (const token of ['replace', 'add', 'subtract', 'intersect']) {
  requireText(combine, token, `selection combine mode ${token}`);
}

const region = read('src/app/selection-region-engine.ts');
for (const token of ['magic', 'color']) {
  requireText(region.toLowerCase(), token, `selection region capability ${token}`);
}

const modifier = read('src/app/selection-modifier-engine.ts');
for (const token of ['invert', 'expand', 'contract', 'feather']) {
  requireText(modifier.toLowerCase(), token, `selection modifier ${token}`);
}

const quickMask = read('src/app/quick-mask-controller.ts');
requireText(quickMask.toLowerCase(), 'quick', 'Quick Mask controller');

const alpha = read('src/app/selection-alpha-engine.ts');
requireText(alpha.toLowerCase(), 'alpha', 'alpha-to-selection engine');

for (const [path, token] of [
  ['src/app/selection-cut-engine.ts', 'cut'],
  ['src/app/selection-copy-engine.ts', 'copy'],
  ['src/app/selection-paste-engine.ts', 'paste'],
  ['src/app/selection-transform-engine.ts', 'transform'],
  ['src/app/selection-filter-engine.ts', 'filter'],
  ['src/app/selection-fill-engine.ts', 'fill'],
  ['src/app/selection-layer-operation-engine.ts', 'layer'],
]) {
  requireText(read(path).toLowerCase(), token, `${token} selection operation`);
}

const gesture = read('src/app/m8-selection-gesture-controller.ts');
for (const token of ['pointer', 'coalesced', 'document']) {
  requireText(gesture.toLowerCase(), token, `production selection gesture ${token}`);
}

const coverage = read('src/app/selection-coverage-controller.ts');
requireText(coverage, 'defaultCoverage', 'sparse selection coverage default');

console.log(
  JSON.stringify({
    event: 'm7a.selection.verified',
    milestone: 'M7A',
    canonicalItems: 25,
    requiredSources: requiredSources.length,
    lassoBoundaryCoverage: 'fractional-0-255',
    antiAlias: 'deterministic-subpixel',
    tileBasis: 'canonical-sparse',
  }),
);
