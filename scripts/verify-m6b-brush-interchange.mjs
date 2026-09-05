import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireFile(path, label) {
  if (!fs.existsSync(path)) {
    throw new Error(`M6B verification failed: ${label}`);
  }
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`M6B verification failed: ${label}`);
  }
}

const requiredSourceFiles = [
  'src/interchange/zip-v1.ts',
  'src/interchange/illbrush-v1.ts',
  'src/interchange/ibis-brush-envelope-v1.ts',
  'src/interchange/ibis-brush-parser-v1.ts',
  'src/interchange/ibis-qr-carrier-v1.ts',
  'src/interchange/ibis-brush-mapper-v1.ts',
  'src/interchange/csp-sut-parser-v1.ts',
  'src/interchange/csp-brush-mapper-v1.ts',
  'src/interchange/brush-import-property-report-v1.ts',
  'src/interchange/imported-brush-normalizer-v1.ts',
  'src/app/brush-interchange-service.ts',
  'src/app/brush-interchange-controller.ts',
];
for (const path of requiredSourceFiles) {
  requireFile(path, `missing production interchange source: ${path}`);
}

const requiredTests = [
  'tests/unit/illbrush-v1.test.ts',
  'tests/unit/brush-interchange-service.test.ts',
  'tests/unit/ibis-brush-parser-v1.test.ts',
  'tests/unit/ibis-qr-carrier-v1.test.ts',
  'tests/unit/ibis-brush-mapper-v1.test.ts',
  'tests/unit/csp-sut-parser-v1.test.ts',
  'tests/unit/csp-brush-mapper-v1.test.ts',
  'tests/unit/brush-import-property-report-v1.test.ts',
  'tests/unit/imported-brush-normalizer-v1.test.ts',
];
for (const path of requiredTests) {
  requireFile(path, `missing M6B regression coverage: ${path}`);
}

const progress = read('IMPLEMENTATION_PROGRESS.md');
for (const line of [
  'M6B-001 `.illbrush` parser:完了',
  'M6B-002 `.illbrush` writer:完了',
  'M6B-003 Illustro brush import:完了',
  'M6B-004 Illustro brush export:完了',
  'M6B-005 ibisPaint custom brush parser:完了',
  'M6B-006 ibisPaint brush QR carrier decode:完了',
  'M6B-007 ibis→Illustro parameter mapper:完了',
  'M6B-008 CSP `.sut` parser:完了',
  'M6B-009 CSP→Illustro parameter mapper:完了',
  'M6B-010 unsupported brush property reporting:完了',
  'M6B-011 imported brush canonical normalization:完了',
]) {
  requireText(progress, line, `progress prerequisite is incomplete: ${line}`);
}

const design = read('ILLUSTRO_DESIGN_MEMO.md');
requireText(
  design,
  'Imported brushes are normalized into the Illustro Canonical Brush Model',
  'canonical imported-brush design invariant is missing',
);
requireText(
  design,
  'No import parser may mutate the open document incrementally before validation reaches its canonical-commit boundary.',
  'canonical import commit-boundary invariant is missing',
);
requireText(
  design,
  '## FC-2. ibisPaint / CLIP STUDIO brush-import compatibility contract — PASS',
  'FC-2 compatibility contract is missing',
);

const illbrush = read('src/interchange/illbrush-v1.ts');
requireText(illbrush, 'parseIllbrushPackageV1', 'native .illbrush parser is disconnected');
requireText(illbrush, 'writeIllbrushPackageV1', 'native .illbrush writer is disconnected');
requireText(illbrush, 'SHA-256', 'native package integrity verification is missing');

const ibisParser = read('src/interchange/ibis-brush-parser-v1.ts');
requireText(ibisParser, "DecompressionStream('deflate-raw')", 'ibis IPBZ raw-deflate decoding is missing');
requireText(ibisParser, 'declaredPayloadByteLength', 'ibis payload length validation is missing');

const ibisQr = read('src/interchange/ibis-qr-carrier-v1.ts');
requireText(ibisQr, 'binaryData', 'ibis QR decoding is not binary-safe');
requireText(ibisQr, 'parseIbisBrushEnvelopeV1(payload)', 'ibis QR carrier does not validate the decoded payload');

const cspParser = read('src/interchange/csp-sut-parser-v1.ts');
requireText(cspParser, 'SQLite format 3', 'CSP SUT SQLite header validation is missing');
requireText(cspParser, 'initSqlJs', 'CSP SUT parser is not connected to the SQLite runtime');
requireText(cspParser, 'database.close()', 'CSP SUT parser does not close read-only SQLite state');

const report = read('src/interchange/brush-import-property-report-v1.ts');
requireText(report, 'createCompatibilityReport', 'unsupported property reporting is not structured');
requireText(report, "mapping: 'ignored'", 'unsupported imported properties are not explicitly reported');

const normalizer = read('src/interchange/imported-brush-normalizer-v1.ts');
requireText(normalizer, 'normalizeBrushPresetV1', 'imported brushes are not canonically normalized');
requireText(normalizer, 'stageIbisBrushImportV1', 'ibis import staging boundary is missing');
requireText(normalizer, 'stageCspBrushImportV1', 'CSP import staging boundary is missing');
requireText(normalizer, 'ImportedBrushAcceptanceRequiredErrorV1', 'lossy import acceptance gate is missing');
requireText(normalizer, 'commitImportedBrushStageV1', 'canonical imported-brush commit boundary is missing');

const service = read('src/app/brush-interchange-service.ts');
requireText(service, 'parseCspSutV1', 'production CSP import does not use the validated parser');
requireText(service, 'decodeIbisBrushQrBlobV1', 'production ibis import does not use binary-safe QR decoding');
requireText(service, 'commitImportedBrushStageV1', 'production external import bypasses canonical commit normalization');

const controller = read('src/app/brush-interchange-controller.ts');
requireText(controller, 'acceptLossyMapping', 'production UI does not expose the lossy-import acceptance boundary');

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.jsqr !== '1.4.0') {
  throw new Error('M6B verification failed: jsQR runtime must remain pinned to 1.4.0');
}
if (packageJson.dependencies?.['sql.js'] !== '1.14.2') {
  throw new Error('M6B verification failed: sql.js runtime must remain pinned to 1.14.2');
}

const html = read('src/index.html');
requireText(html, './vendor/jsQR.js', 'jsQR runtime is not loaded by the production shell');
requireText(html, './vendor/sql-wasm.js', 'sql.js runtime is not loaded by the production shell');

for (const path of ['dist/vendor/jsQR.js', 'dist/vendor/sql-wasm.js', 'dist/vendor/sql-wasm.wasm']) {
  requireFile(path, `production build is missing required brush-import runtime: ${path}`);
}

console.log('M6B brush interchange verification passed.');
