import fs from 'node:fs';

const requiredFiles = [
  'src/app/paint-session-controller.ts',
  'src/app/paint-history-controller.ts',
  'src/app/paint-persistence-controller.ts',
  'src/export/png-export.ts',
  'src/gpu/baseline-paint-renderer.ts',
  'src/workers/render.worker.ts',
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`M4 production file missing: ${file}`);
}
const main = fs.readFileSync('src/app/main.ts', 'utf8');
for (const contract of [
  'paintHistory.commitCompletedStroke',
  'paintPersistence.markDirty',
  'paintPersistence.initialize',
  'encodePaintSnapshotToPngV1',
  'downloadPngBlobV1',
  'export-png',
]) {
  if (!main.includes(contract)) throw new Error(`M4 production wiring missing: ${contract}`);
}
const exportSource = fs.readFileSync('src/export/png-export.ts', 'utf8');
for (const contract of [
  'iterateBaselinePaintFlattenTilesV1',
  'smoothstep(0.85, 1, radialDistance)',
  'assertPngBlobV1',
  'type: PNG_MIME_TYPE',
]) {
  if (!exportSource.includes(contract)) throw new Error(`M4 PNG contract missing: ${contract}`);
}
const shader = fs.readFileSync('src/gpu/shaders/baseline-brush.wgsl', 'utf8');
if (!shader.includes('smoothstep(0.85, 1.0, radial_distance)')) {
  throw new Error('M4 baseline shader coverage contract changed without PNG flatten update');
}
console.log(
  JSON.stringify({ schema: 'illustro.verify-m4/1', status: 'pass', files: requiredFiles.length }),
);
