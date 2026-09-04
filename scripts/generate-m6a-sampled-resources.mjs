import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const WIDTH = 1024;
const HEIGHT = 1024;
const PACKAGE_FILE = 'ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-09-04.zip';
const FIXED_DATE = '2026-09-04';
const generatedPublicRoot = new URL('../.build/generated-public/', import.meta.url);
const outRoot = new URL('assets/sampled/', generatedPublicRoot);
const packageRoot = new URL('../.build/generated-sampled-package/', import.meta.url);
const EXPECTED_PACKAGE_SHA256 = '7ba886fd15e22fcce3d6b0ae0004c85eb8370626346a00cff3d40c0955ad2eec';
const EXPECTED_PACKAGE_MANIFEST_SHA256 = 'b7321b529e5fa281b82a435ec7bc5f81a10dafe057e530216bb7b49e973e4783';
const EXPECTED_SOURCE_MANIFEST_SHA256 = '97d44976ab0e87b8f3ae5538afa8f5c809b7497a6c060559d74902e0cfaa1355';
const EXPECTED_LOADER_MANIFEST_SHA256 = '964993be658aec8cf476b171d5b4905dd96f4c2c0230ed698966854987d8f138';
const EXPECTED_TOTAL_PAYLOAD_BYTES = 28156613;

function numbered(prefix, start, end, kind, subtype = null, group = '') {
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const n = String(start + i).padStart(2, '0');
    return { alias: `${prefix}.${n}`, kind, subtype, group, index: start + i };
  });
}

const resources = Object.freeze([
  ...numbered('builtin.tip.ink', 6, 8, 'brush-tip', null, 'ink'),
  ...numbered('builtin.tip.pencil', 1, 10, 'brush-tip', null, 'pencil'),
  ...numbered('builtin.tip.paint', 5, 12, 'brush-tip', null, 'paint'),
  ...numbered('builtin.tip.scatter', 1, 12, 'brush-tip', null, 'scatter'),
  ...numbered('builtin.grain.fine', 1, 6, 'grain', 'grain', 'fine'),
  ...numbered('builtin.grain.rough', 1, 6, 'grain', 'grain', 'rough'),
  ...numbered('builtin.grain.fiber', 1, 5, 'grain', 'grain', 'fiber'),
  ...numbered('builtin.grain.canvas', 1, 3, 'grain', 'grain', 'canvas'),
  ...numbered('builtin.grain.paper', 1, 12, 'grain', 'paper', 'paper'),
  ...numbered('builtin.pattern.geometric', 1, 4, 'pattern', null, 'geometric'),
  ...numbered('builtin.pattern.organic', 1, 4, 'pattern', null, 'organic'),
  ...numbered('builtin.pattern.texture', 1, 4, 'pattern', null, 'texture'),
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function hash2(x, y, seed) {
  let h = (seed ^ Math.imul(x + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y + 0xc2b2ae35, 0x27d4eb2d)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h / 0xffffffff;
}
function periodicNoise(x, y, seed, octaves = 5) {
  const tx = (2 * Math.PI * x) / WIDTH;
  const ty = (2 * Math.PI * y) / HEIGHT;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    const fx = 1 + ((seed >>> (i * 3)) & 7) + i * 2;
    const fy = 1 + ((seed >>> (i * 4 + 1)) & 7) + i * 3;
    const phase = ((seed >>> (i * 5 + 2)) & 255) / 255 * Math.PI * 2;
    const amp = 1 / (1 + i * 0.72);
    sum += amp * (Math.sin(tx * fx + ty * (i + 1) + phase) + Math.cos(ty * fy - tx * (i + 2) + phase * 0.73)) * 0.5;
    norm += amp;
  }
  return 0.5 + 0.5 * (sum / norm);
}
function tipAlpha(resource, x, y, seed) {
  const nx = (x + 0.5 - WIDTH / 2) / (WIDTH / 2);
  const ny = (y + 0.5 - HEIGHT / 2) / (HEIGHT / 2);
  const r = Math.hypot(nx, ny);
  const angle = Math.atan2(ny, nx);
  const noise = periodicNoise(x, y, seed, 4);
  let v = 0;
  if (resource.group === 'ink') {
    const stretch = 0.78 + 0.05 * (resource.index - 6);
    const rr = Math.hypot(nx / stretch, ny * (1.05 + 0.08 * (resource.index - 6)));
    const edge = 1 - smoothstep(0.58, 0.96, rr);
    const breakup = 0.48 + 0.52 * Math.pow(noise, 0.75 + 0.25 * (resource.index - 6));
    const notch = 0.82 + 0.18 * Math.sin(angle * (5 + resource.index) + noise * 5);
    v = edge * breakup * notch;
  } else if (resource.group === 'pencil') {
    const elliptic = Math.hypot(nx * (0.92 + resource.index * 0.018), ny / (0.82 + resource.index * 0.012));
    const edge = 1 - smoothstep(0.52, 0.96, elliptic);
    const grit = Math.pow(0.28 + 0.72 * noise, 1.1 + (resource.index % 4) * 0.35);
    const directional = 0.72 + 0.28 * Math.sin((nx * (9 + resource.index) + ny * (3 + resource.index % 5)) * Math.PI + (seed & 255));
    v = edge * grit * directional;
  } else if (resource.group === 'paint') {
    const idx = resource.index - 5;
    const axis = Math.cos(angle * (2 + (idx % 4))) * (0.10 + idx * 0.008);
    const rr = Math.hypot(nx / (0.82 + 0.03 * (idx % 3)), ny / (0.72 + 0.02 * ((idx + 1) % 4)));
    const edge = 1 - smoothstep(0.50 + axis, 0.98, rr);
    const bristles = 0.50 + 0.50 * Math.abs(Math.sin((nx * (8 + idx * 2) + ny * (2 + idx % 3)) * Math.PI + noise * 3));
    const pores = 0.42 + 0.58 * Math.pow(noise, 0.7 + idx * 0.08);
    v = edge * (0.4 + 0.6 * bristles) * pores;
  } else {
    const idx = resource.index;
    const petals = 3 + (idx % 7);
    const radius = 0.46 + 0.10 * Math.sin(angle * petals + idx * 0.61) + 0.05 * Math.sin(angle * (petals + 3) - idx);
    let silhouette = 1 - smoothstep(radius - 0.055, radius + 0.055, r);
    if (idx % 3 === 0) {
      const ring = smoothstep(0.18, 0.24, r) * (1 - smoothstep(radius - 0.10, radius, r));
      silhouette *= ring;
    }
    if (idx % 4 === 0) {
      const cut = 0.65 + 0.35 * Math.sin(angle * (idx / 2 + 2) + 1.2);
      silhouette *= clamp01(cut);
    }
    v = silhouette * (0.68 + 0.32 * noise);
  }
  const border = 1 - smoothstep(0.90, 0.98, r);
  return clamp01(v * border);
}
function grainValue(resource, x, y, seed) {
  const nx = x / WIDTH;
  const ny = y / HEIGHT;
  const tx = 2 * Math.PI * nx;
  const ty = 2 * Math.PI * ny;
  const n = periodicNoise(x, y, seed, 6);
  if (resource.group === 'fine') {
    const k = 12 + resource.index * 5;
    return clamp01(0.5 + (n - 0.5) * (0.32 + resource.index * 0.025) + 0.08 * Math.sin(k * tx + (k + 3) * ty));
  }
  if (resource.group === 'rough') {
    const p = 3 + resource.index;
    const coarse = periodicNoise(x, y, seed ^ 0xa5a5a5a5, 3);
    return clamp01(0.48 + (coarse - 0.5) * 0.78 + (n - 0.5) * 0.34 + 0.08 * Math.sin(p * tx - (p + 2) * ty));
  }
  if (resource.group === 'fiber') {
    const fx = 7 + resource.index * 3;
    const fy = 2 + (resource.index % 4);
    const fibers = Math.pow(Math.abs(Math.sin(fx * tx + fy * ty + 2 * Math.PI * n)), 3);
    return clamp01(0.38 + 0.46 * fibers + 0.28 * (n - 0.5));
  }
  if (resource.group === 'canvas') {
    const f = 4 + resource.index * 2;
    const warp = Math.abs(Math.sin(f * tx + 0.35 * Math.sin(2 * ty)));
    const weft = Math.abs(Math.sin((f + 2) * ty + 0.30 * Math.sin(2 * tx)));
    return clamp01(0.32 + 0.29 * warp + 0.29 * weft + 0.20 * (n - 0.5));
  }
  const idx = resource.index;
  const fibers = Math.abs(Math.sin((7 + idx) * tx + (3 + idx % 5) * ty + (n - 0.5) * 3));
  const tooth = periodicNoise(x, y, seed ^ 0x6d2b79f5, 4);
  return clamp01(0.44 + 0.22 * (fibers - 0.5) + 0.46 * (tooth - 0.5));
}
function patternValue(resource, x, y, seed) {
  const nx = x / WIDTH;
  const ny = y / HEIGHT;
  const tx = 2 * Math.PI * nx;
  const ty = 2 * Math.PI * ny;
  const idx = resource.index;
  if (resource.group === 'geometric') {
    if (idx === 1) return clamp01(0.5 + 0.30 * Math.sin(4 * tx) * Math.sin(4 * ty));
    if (idx === 2) return clamp01(0.5 + 0.24 * Math.cos(6 * tx) + 0.18 * Math.cos(6 * ty));
    if (idx === 3) return clamp01(0.48 + 0.30 * Math.cos(5 * tx + 3 * ty) * Math.cos(3 * tx - 5 * ty));
    return clamp01(0.5 + 0.20 * Math.sin(4 * tx + 2 * ty) + 0.20 * Math.cos(2 * tx - 4 * ty));
  }
  if (resource.group === 'organic') {
    const n = periodicNoise(x, y, seed, 5);
    const warp = Math.sin((2 + idx) * tx + 2.3 * Math.sin((3 + idx) * ty)) + Math.cos((4 + idx) * ty - 1.7 * Math.sin((2 + idx) * tx));
    return clamp01(0.5 + 0.22 * warp + 0.34 * (n - 0.5));
  }
  const n1 = periodicNoise(x, y, seed, 6);
  const n2 = periodicNoise(x, y, seed ^ 0x9e3779b9, 3);
  const bands = Math.sin((9 + idx * 3) * tx + (5 + idx) * ty + n2 * Math.PI);
  return clamp01(0.48 + 0.38 * (n1 - 0.5) + 0.18 * bands);
}
function render(resource) {
  const seed = fnv1a(resource.alias);
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const metric = new Float32Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const i = y * WIDTH + x;
      const p = i * 4;
      if (resource.kind === 'brush-tip') {
        const a = tipAlpha(resource, x, y, seed);
        const av = Math.round(a * 255);
        rgba[p] = 255; rgba[p + 1] = 255; rgba[p + 2] = 255; rgba[p + 3] = av;
        metric[i] = a;
      } else {
        const v = resource.kind === 'grain' ? grainValue(resource, x, y, seed) : patternValue(resource, x, y, seed);
        const gv = Math.round(v * 255);
        rgba[p] = gv; rgba[p + 1] = gv; rgba[p + 2] = gv; rgba[p + 3] = 255;
        metric[i] = v;
      }
    }
  }
  return { rgba, metric, seed };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crc]);
}
function encodePng(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const scan = Buffer.alloc(HEIGHT * (1 + WIDTH * 4));
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = y * (1 + WIDTH * 4);
    scan[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * WIDTH * 4, WIDTH * 4).copy(scan, row + 1);
  }
  const idat = deflateSync(scan, { level: 9 });
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function resourceRelativePath(resource) {
  const dir = resource.kind === 'brush-tip' ? 'tips' : resource.kind === 'grain' ? 'grains' : 'patterns';
  return `${dir}/${resource.alias}.png`;
}
function pearson(a, b, step = 16) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 0; y < HEIGHT; y += step) for (let x = 0; x < WIDTH; x += step) {
    const i = y * WIDTH + x; const av = a[i]; const bv = b[i];
    n += 1; sa += av; sb += bv; saa += av * av; sbb += bv * bv; sab += av * bv;
  }
  const num = n * sab - sa * sb;
  const den = Math.sqrt(Math.max(1e-12, (n * saa - sa * sa) * (n * sbb - sb * sb)));
  return num / den;
}
function seamScore(metric) {
  let total = 0; let count = 0;
  for (let y = 0; y < HEIGHT; y += 1) { total += Math.abs(metric[y * WIDTH] - metric[y * WIDTH + WIDTH - 1]); count += 1; }
  for (let x = 0; x < WIDTH; x += 1) { total += Math.abs(metric[x] - metric[(HEIGHT - 1) * WIDTH + x]); count += 1; }
  return total / count;
}
function borderMaxAlpha(metric) {
  let max = 0;
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    if (x < 6 || y < 6 || x >= WIDTH - 6 || y >= HEIGHT - 6) max = Math.max(max, metric[y * WIDTH + x]);
  }
  return max;
}

function dosDateTime() {
  const year = 2026, month = 9, day = 4, hour = 0, minute = 0, second = 0;
  return { date: ((year - 1980) << 9) | (month << 5) | day, time: (hour << 11) | (minute << 5) | Math.floor(second / 2) };
}
function makeZip(entries) {
  const { date, time } = dosDateTime();
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(0,6); local.writeUInt16LE(0,8);
    local.writeUInt16LE(time,10); local.writeUInt16LE(date,12); local.writeUInt32LE(crc,14);
    local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(nameBytes.length,26); local.writeUInt16LE(0,28);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0,8); central.writeUInt16LE(0,10);
    central.writeUInt16LE(time,12); central.writeUInt16LE(date,14); central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24);
    central.writeUInt16LE(nameBytes.length,28); central.writeUInt16LE(0,30); central.writeUInt16LE(0,32); central.writeUInt16LE(0,34); central.writeUInt16LE(0,36);
    central.writeUInt32LE(0,38); central.writeUInt32LE(offset,42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralData = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4); end.writeUInt16LE(0,6);
  end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centralData.length,12); end.writeUInt32LE(offset,16); end.writeUInt16LE(0,20);
  return Buffer.concat([...locals, centralData, end]);
}

await rm(outRoot, { recursive: true, force: true });
await rm(packageRoot, { recursive: true, force: true });
await mkdir(outRoot, { recursive: true });
await mkdir(packageRoot, { recursive: true });

const rendered = [];
for (const resource of resources) {
  const { rgba, metric, seed } = render(resource);
  const png = encodePng(rgba);
  const rel = resourceRelativePath(resource);
  const fileUrl = new URL(rel, outRoot);
  await mkdir(new URL('./', fileUrl), { recursive: true });
  await writeFile(fileUrl, png);
  rendered.push({ resource, metric, seed, png, rel, hash: sha256(png) });
}

const counts = rendered.reduce((a, x) => {
  if (x.resource.kind === 'brush-tip') a.brushTip += 1;
  if (x.resource.kind === 'grain') { a.grain += 1; if (x.resource.subtype === 'paper') a.paper += 1; }
  if (x.resource.kind === 'pattern') a.pattern += 1;
  return a;
}, { brushTip: 0, grain: 0, paper: 0, pattern: 0 });
if (rendered.length !== 77 || counts.brushTip !== 33 || counts.grain !== 32 || counts.paper !== 12 || counts.pattern !== 12) {
  throw new Error(`inventory mismatch ${JSON.stringify(counts)}`);
}
const hashes = new Set(rendered.map((x) => x.hash));
if (hashes.size !== rendered.length) throw new Error('exact duplicate resource payload detected');
for (const x of rendered.filter((x) => x.resource.kind === 'brush-tip')) {
  const b = borderMaxAlpha(x.metric);
  if (b > 0.01) throw new Error(`brush-tip border containment failed ${x.resource.alias}: ${b}`);
}
let maxSeam = 0;
for (const x of rendered.filter((x) => x.resource.kind !== 'brush-tip')) {
  const s = seamScore(x.metric); maxSeam = Math.max(maxSeam, s);
  if (s > 0.12) throw new Error(`seam score failed ${x.resource.alias}: ${s}`);
}
let maxCorr = -1; let maxPair = null;
for (let i = 0; i < rendered.length; i += 1) for (let j = i + 1; j < rendered.length; j += 1) {
  if (rendered[i].resource.kind !== rendered[j].resource.kind) continue;
  const c = pearson(rendered[i].metric, rendered[j].metric);
  if (c > maxCorr) { maxCorr = c; maxPair = [rendered[i].resource.alias, rendered[j].resource.alias]; }
}
if (maxCorr > 0.995) throw new Error(`perceptual duplicate threshold failed ${maxCorr}: ${maxPair?.join(' / ')}`);

const sourceManifest = {
  schema: 'illustro.sampled-resource-source/2',
  canonicalDate: FIXED_DATE,
  generationPolicy: 'procedural-first-original-deterministic-v2',
  dimensions: { width: WIDTH, height: HEIGHT },
  retainedInventory: { brushTip: 33, grain: 32, paperSubtype: 12, pattern: 12, total: 77 },
  resources: rendered.map(({ resource, seed, rel }) => ({ alias: resource.alias, kind: resource.kind, subtype: resource.subtype, group: resource.group, index: resource.index, seed, payload: rel })),
};
const sourceBytes = Buffer.from(stableJson(sourceManifest));
const sourceManifestSha256 = sha256(sourceBytes);

const packageManifest = {
  schema: 'illustro.sampled-resource-package/2',
  canonicalDate: FIXED_DATE,
  sourceManifestSha256,
  resources: rendered.map(({ resource, rel, hash, png }) => ({ alias: resource.alias, kind: resource.kind, subtype: resource.subtype, payload: rel, sha256: hash, byteLength: png.length, mimeType: 'image/png' })),
};
const packageManifestBytes = Buffer.from(stableJson(packageManifest));
const packageManifestSha256 = sha256(packageManifestBytes);
const zipEntries = [
  ['manifest/source-manifest.json', sourceBytes],
  ['manifest/package-manifest.json', packageManifestBytes],
  ...rendered.map(({ rel, png }) => [`resources/${rel}`, png]),
].sort((a,b) => a[0].localeCompare(b[0]));
const zip = makeZip(zipEntries);
const packageSha256 = sha256(zip);
await writeFile(new URL(PACKAGE_FILE, packageRoot), zip);

const loaderManifest = {
  schema: 'illustro.builtin-sampled-resources/1',
  packageFileName: PACKAGE_FILE,
  packageSha256,
  sourceManifestSha256,
  resources: rendered.map(({ resource, rel, hash, png }) => ({
    alias: resource.alias,
    kind: resource.kind,
    subtype: resource.subtype,
    payloadPath: `./assets/sampled/${rel}`,
    contentHash: hash,
    byteLength: png.length,
    mimeType: 'image/png',
  })),
};
const loaderManifestBytes = Buffer.from(stableJson(loaderManifest));
const loaderManifestSha256 = sha256(loaderManifestBytes);
const totalPayloadBytes = rendered.reduce((n, x) => n + x.png.length, 0);
if (packageSha256 !== EXPECTED_PACKAGE_SHA256) throw new Error(`canonical package SHA drift: ${packageSha256}`);
if (packageManifestSha256 !== EXPECTED_PACKAGE_MANIFEST_SHA256) throw new Error(`canonical package manifest SHA drift: ${packageManifestSha256}`);
if (sourceManifestSha256 !== EXPECTED_SOURCE_MANIFEST_SHA256) throw new Error(`canonical source manifest SHA drift: ${sourceManifestSha256}`);
if (loaderManifestSha256 !== EXPECTED_LOADER_MANIFEST_SHA256) throw new Error(`canonical loader manifest SHA drift: ${loaderManifestSha256}`);
if (totalPayloadBytes !== EXPECTED_TOTAL_PAYLOAD_BYTES) throw new Error(`canonical payload byte count drift: ${totalPayloadBytes}`);
await writeFile(new URL('manifest.json', outRoot), loaderManifestBytes);
await writeFile(new URL('source-manifest.json', outRoot), sourceBytes);
await writeFile(new URL('qa-report.json', outRoot), stableJson({
  schema: 'illustro.sampled-resource-qa/2',
  canonicalDate: FIXED_DATE,
  counts,
  totalPayloadBytes,
  exactDuplicateGroups: 0,
  maximumSameKindCorrelation: maxCorr,
  maximumSameKindCorrelationPair: maxPair,
  maximumSeamScore: maxSeam,
  packageFileName: PACKAGE_FILE,
  packageSha256,
  packageManifestSha256,
  sourceManifestSha256,
  loaderManifestSha256,
}));

console.log(JSON.stringify({
  event: 'm6a.sampled-resources.generated',
  counts,
  totalPayloadBytes,
  packageFileName: PACKAGE_FILE,
  packageSha256,
  packageManifestSha256,
  sourceManifestSha256,
  loaderManifestSha256,
  maximumSameKindCorrelation: maxCorr,
  maximumSameKindCorrelationPair: maxPair,
  maximumSeamScore: maxSeam,
}, null, 2));
