import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const SIZE = 256;
const GENERATION_ID = '2026-09-05-deterministic-svg-v1';
const outDir = new URL('../.build/generated-public/assets/brush-thumbnails/', import.meta.url);
const metaDir = new URL('../.build/meta/', import.meta.url);

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const h32 = (text) => createHash('sha256').update(text).digest().readUInt32LE(0);
const rnd = (seed, i) => {
  let x = (seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x / 0x100000000;
};
const esc = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isPressureResponsive = (preset) => /[SOF]/.test(preset.flags);
const seedMode = (mode) => (mode === 'representative' ? mode : 'pressure-reference');

function parsePack(source) {
  const match = source.match(/const RAW = `([\s\S]*?)`;/);
  if (!match) throw new Error('default brush pack RAW table missing');
  const presets = match[1]
    .trim()
    .split('\n')
    .map((line) => {
      const [id, name, category, behavior, size, hardness, spacing, flags, surface, tip, dynamics] =
        line.split('|');
      const d = dynamics.split(',').map(Number);
      return {
        id,
        name,
        category,
        behavior,
        size: Number(size),
        hardness: Number(hardness),
        spacing: Number(spacing),
        flags,
        surface,
        tip,
        textureStrength: d[2] ?? 0,
        angle: d[3] ?? 0,
        sizeJitter: d[6] ?? 0,
        positionJitter: d[7] ?? 0,
        densityJitter: d[8] ?? 0,
      };
    });
  if (presets.length !== 48) throw new Error(`expected 48 presets, got ${presets.length}`);
  if (new Set(presets.map((p) => p.id)).size !== 48) throw new Error('duplicate preset IDs');
  return presets;
}

function pressure(t, mode) {
  if (mode === 'low') return 0.24;
  if (mode === 'high') return 0.94;
  return 0.25 + 0.69 * Math.sin(Math.PI * t);
}

function pointsFor(preset, mode) {
  const seed = h32(`${GENERATION_ID}:${preset.id}:${seedMode(mode)}`);
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    const p = pressure(t, mode);
    const scatter = preset.category === 'Scatter / Special' || preset.name === 'Sponge';
    return {
      x:
        22 +
        t * 212 +
        (rnd(seed, i * 2) - 0.5) * (scatter ? 9 : preset.positionJitter * 8),
      y:
        128 +
        Math.sin(t * Math.PI * 2.08 - 0.4) * 27 +
        (rnd(seed, i * 2 + 1) - 0.5) * (scatter ? 16 : 3),
      p,
      r: clamp(
        Math.sqrt(Math.max(1, preset.size)) *
          2.55 *
          (preset.flags.includes('S') ? 0.3 + p * 0.86 : 1) *
          (1 + (rnd(seed ^ 0x51f15e5d, i) - 0.5) * preset.sizeJitter),
        1.4,
        29,
      ),
      a: preset.flags.includes('O') ? 0.2 + p * 0.8 : 0.84,
    };
  });
}

function representativeSvg(preset, mode) {
  const seed = h32(`${GENERATION_ID}:${preset.id}:${seedMode(mode)}:detail`);
  const points = pointsFor(preset, mode);
  const textured = preset.surface !== '-' || preset.tip !== '-';
  const scatter = preset.category === 'Scatter / Special' || preset.name === 'Sponge';
  const chisel = preset.flags.includes('Q') || /Flat|Knife|Chisel/.test(preset.name);
  const soft =
    preset.hardness < 0.35 || preset.category === 'Airbrush' || preset.behavior === 'blur';
  const stroke = preset.behavior === 'erase' ? '#fbfcff' : '#26324b';
  const defs = soft
    ? '<defs><filter id="soft"><feGaussianBlur stdDeviation="2.8"/></filter></defs>'
    : '';
  const background =
    preset.behavior === 'erase'
      ? '<rect x="14" y="68" width="228" height="120" rx="18" fill="#68758d" opacity=".72"/>'
      : '<rect width="256" height="256" rx="18" fill="#fbfcff"/>';
  const segments = points
    .slice(0, -1)
    .map((p, i) => {
      const q = points[i + 1];
      const width = Math.max(1.4, (p.r + q.r) * (chisel ? 1.38 : 1.72));
      const flow = preset.flags.includes('F') ? 0.35 + ((p.p + q.p) / 2) * 0.65 : 1;
      const alpha = ((p.a + q.a) / 2) * (textured ? 0.78 : 0.9) * flow;
      const dash = textured
        ? ` stroke-dasharray="${(3 + rnd(seed, i) * 8).toFixed(2)} ${(1.5 + preset.textureStrength * 7 + rnd(seed, i + 50) * 4).toFixed(2)}"`
        : '';
      return `<path d="M${p.x.toFixed(2)} ${p.y.toFixed(2)} L${q.x.toFixed(2)} ${q.y.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${width.toFixed(2)}" stroke-linecap="${chisel ? 'square' : 'round'}" opacity="${alpha.toFixed(3)}"${dash}${soft ? ' filter="url(#soft)"' : ''}/>`;
    })
    .join('');
  const particles = scatter
    ? points
        .flatMap((p, i) =>
          Array.from({ length: 3 + Math.round(preset.densityJitter * 4) }, (_, j) => {
            const angle = rnd(seed ^ 0xa5a5a5a5, i * 11 + j) * Math.PI * 2;
            const distance = 6 + rnd(seed ^ 0x5a5a5a5a, i * 13 + j) * 25;
            const radius = 1.4 + rnd(seed, i * 17 + j) * Math.max(2, p.r * 0.48);
            const flow = preset.flags.includes('F') ? 0.35 + p.p * 0.65 : 1;
            return `<circle cx="${(p.x + Math.cos(angle) * distance).toFixed(2)}" cy="${(p.y + Math.sin(angle) * distance).toFixed(2)}" r="${radius.toFixed(2)}" fill="${stroke}" opacity="${((0.28 + rnd(seed, i * 19 + j) * 0.44) * flow).toFixed(3)}"/>`;
          }),
        )
        .join('')
    : '';
  const blend =
    preset.behavior === 'smudge' || preset.behavior === 'blur'
      ? Array.from(
          { length: 5 },
          (_, i) =>
            `<path d="M30 ${82 + i * 23} C82 ${62 + i * 22},172 ${109 + i * 10},228 ${84 + i * 23}" fill="none" stroke="#53627c" stroke-width="${8 + i * 2}" stroke-linecap="round" opacity="${(0.12 + i * 0.055).toFixed(3)}"${preset.behavior === 'blur' ? ' filter="url(#soft)"' : ''}/>` ,
        ).join('')
      : '';
  const body = blend || `${segments}${particles}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${esc(preset.name)} brush thumbnail">${defs}${background}<rect x=".5" y=".5" width="255" height="255" rx="17.5" fill="none" stroke="#e7ebf2"/>${body}</svg>\n`;
}

async function writeAsset(name, content) {
  await writeFile(new URL(name, outDir), content, 'utf8');
  return {
    path: `assets/brush-thumbnails/${name}`,
    sha256: sha256(content),
    byteLength: Buffer.byteLength(content),
  };
}

const source = await readFile(new URL('../src/app/default-brush-pack.ts', import.meta.url), 'utf8');
const presets = parsePack(source);
const presetsById = new Map(presets.map((preset) => [preset.id, preset]));
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(metaDir, { recursive: true });

const entries = [];
for (const preset of presets) {
  const thumbnail = await writeAsset(
    `${preset.id}.svg`,
    representativeSvg(preset, 'representative'),
  );
  const pressureLow = await writeAsset(
    `${preset.id}.pressure-low.svg`,
    representativeSvg(preset, 'low'),
  );
  const pressureHigh = await writeAsset(
    `${preset.id}.pressure-high.svg`,
    representativeSvg(preset, 'high'),
  );
  entries.push({
    id: preset.id,
    name: preset.name,
    category: preset.category,
    behavior: preset.behavior,
    pressureResponsive: isPressureResponsive(preset),
    thumbnail,
    pressureLow,
    pressureHigh,
  });
}

const mainHashes = new Set(entries.map((entry) => entry.thumbnail.sha256));
if (mainHashes.size !== 48) throw new Error(`thumbnail uniqueness failed: ${mainHashes.size}/48`);
const responsiveEntries = entries.filter((entry) => entry.pressureResponsive);
const nonResponsiveEntries = entries.filter((entry) => !entry.pressureResponsive);
const responsiveDistinctCount = responsiveEntries.filter(
  (entry) => entry.pressureLow.sha256 !== entry.pressureHigh.sha256,
).length;
const nonResponsiveStableCount = nonResponsiveEntries.filter(
  (entry) => entry.pressureLow.sha256 === entry.pressureHigh.sha256,
).length;
if (responsiveDistinctCount !== responsiveEntries.length) {
  throw new Error(
    `pressure-responsive reference differentiation failed: ${responsiveDistinctCount}/${responsiveEntries.length}`,
  );
}
if (nonResponsiveStableCount !== nonResponsiveEntries.length) {
  throw new Error(
    `non-responsive pressure reference stability failed: ${nonResponsiveStableCount}/${nonResponsiveEntries.length}`,
  );
}

const contactSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1536" viewBox="0 0 2048 1536">${entries.map((entry, i) => `<image href="${entry.id}.svg" x="${(i % 8) * 256}" y="${Math.floor(i / 8) * 256}" width="256" height="256"/>`).join('')}</svg>\n`;
const contactSheetAsset = await writeAsset('contact-sheet.svg', contactSheet);
const categories = [...new Set(entries.map((entry) => entry.category))];
const categoryPressureQa = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="${categories.length * 256}" viewBox="0 0 512 ${categories.length * 256}">${categories
  .map((category, i) => {
    const categoryEntries = entries.filter((entry) => entry.category === category);
    const entry = categoryEntries.find((candidate) => candidate.pressureResponsive) ?? categoryEntries[0];
    if (!entry) throw new Error(`missing category representative: ${category}`);
    return `<image href="${entry.id}.pressure-low.svg" x="0" y="${i * 256}" width="256" height="256"/><image href="${entry.id}.pressure-high.svg" x="256" y="${i * 256}" width="256" height="256"/>`;
  })
  .join('')}</svg>\n`;
const categoryPressureAsset = await writeAsset('category-pressure-qa.svg', categoryPressureQa);

for (const entry of entries) {
  if (!presetsById.has(entry.id)) throw new Error(`orphan thumbnail entry: ${entry.id}`);
}

const manifest = {
  schema: 'illustro.default-brush-thumbnails/1',
  generationId: GENERATION_ID,
  dimensions: [SIZE, SIZE],
  presetCount: 48,
  categoryCount: categories.length,
  deterministicSeedBasis:
    'sha256(generationId:presetId:representative|pressure-reference); low/high share random field',
  pressureSemantics:
    'S/O/F presets must differ between low/high; non-responsive presets must remain identical',
  visualReferenceBasis: [
    'J-4 256x256 deterministic representative-stroke thumbnail contract',
    'accepted light Canvas-First Brush Presets UI visual reference',
    'accepted representative asset boards using isolated material strokes/swatches',
  ],
  entries,
  contactSheet: contactSheetAsset,
  categoryPressureQa: categoryPressureAsset,
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(new URL('manifest.json', outDir), manifestText, 'utf8');
const summary = {
  schema: 'illustro.m6a-brush-thumbnail-regeneration-verification/1',
  generationId: GENERATION_ID,
  presetCount: 48,
  dimensions: [SIZE, SIZE],
  mainThumbnailUniqueHashes: mainHashes.size,
  pressureReferencePairs: entries.length,
  pressureResponsivePairCount: responsiveEntries.length,
  pressureResponsiveDistinctPairs: responsiveDistinctCount,
  pressureNonResponsivePairCount: nonResponsiveEntries.length,
  pressureNonResponsiveStablePairs: nonResponsiveStableCount,
  manifestSHA256: sha256(manifestText),
  contactSheetSHA256: contactSheetAsset.sha256,
  categoryPressureQaSHA256: categoryPressureAsset.sha256,
  failureCount: 0,
};
await writeFile(
  new URL('m6a-brush-thumbnails.json', metaDir),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({ event: 'm6a.brush-thumbnails.generated', ...summary }));
