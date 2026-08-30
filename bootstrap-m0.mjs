import { gunzipSync } from 'node:zlib';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const partDir = '.m0-bootstrap';
const parts = (await readdir(partDir)).filter((name) => name.startsWith('part')).sort();
const encoded = (await Promise.all(parts.map((name) => readFile(`${partDir}/${name}`, 'utf8')))).join('');
const files = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
for (const [path, content] of Object.entries(files)) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
console.log(JSON.stringify({ event: 'm0.bootstrap.materialized', files: Object.keys(files).length }));
