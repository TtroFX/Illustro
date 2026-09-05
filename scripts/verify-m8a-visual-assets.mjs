import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const EXPECTED = {
  ui: {
    sha256: '32a6cb3991c9baa5b5e097943ce0550a3968d2dcde1be68e132f30ce03341a13',
    bytes: 1169382,
    width: 1536,
    height: 1024,
  },
  icon: {
    sha256: 'bcfe9b5f2a007ce4e451289e66b866052ce81d43e82d78efffa55b9eeb51fa8d',
    bytes: 157659,
    width: 1536,
    height: 1536,
  },
};

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || !value)
      throw new Error(`Invalid arguments near ${key ?? '<end>'}`);
    result[key.slice(2)] = value;
  }
  return result;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pngDimensions(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) throw new Error('Not a PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG');
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    const sof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error('JPEG dimensions not found');
}

function verify(label, path, expected, kind) {
  const bytes = readFileSync(path);
  const digest = sha256(bytes);
  const dims = kind === 'png' ? pngDimensions(bytes) : jpegDimensions(bytes);
  const failures = [];
  if (digest !== expected.sha256) failures.push(`sha256 ${digest}`);
  if (bytes.length !== expected.bytes) failures.push(`bytes ${bytes.length}`);
  if (dims.width !== expected.width || dims.height !== expected.height) {
    failures.push(`dimensions ${dims.width}x${dims.height}`);
  }
  if (failures.length) throw new Error(`${label} failed: ${failures.join(', ')}`);
  console.log(
    `PASS ${label}: ${basename(path)} ${digest} ${bytes.length}B ${dims.width}x${dims.height}`,
  );
  return bytes;
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['ui', 'ui-backup', 'icon', 'icon-backup']) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const ui = verify('canonical-ui', args.ui, EXPECTED.ui, 'png');
const uiBackup = verify('canonical-ui-backup', args['ui-backup'], EXPECTED.ui, 'png');
const icon = verify('canonical-icon', args.icon, EXPECTED.icon, 'jpeg');
const iconBackup = verify('canonical-icon-backup', args['icon-backup'], EXPECTED.icon, 'jpeg');

if (!ui.equals(uiBackup)) throw new Error('UI primary/backup bytes differ');
if (!icon.equals(iconBackup)) throw new Error('Icon primary/backup bytes differ');

console.log(
  'PASS M8A canonical visual assets: primary and backup copies are byte-identical and match frozen identities.',
);
