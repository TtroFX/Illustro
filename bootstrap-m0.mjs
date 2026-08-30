import { gunzipSync } from 'node:zlib';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const binaryPaths = [
  '.m0-bootstrap-bin/part00.bin',
  '.m0-bootstrap-bin/part01-00.bin',
  '.m0-bootstrap-bin/part01-01.bin',
  '.m0-bootstrap-bin/part01-02.bin',
  '.m0-bootstrap-bin/part01-03.bin',
  '.m0-bootstrap-bin/part01-04.bin',
];
const chunks = await Promise.all(binaryPaths.map((path) => readFile(path)));
for (const name of ['part02.txt', 'part03.txt', 'part04.txt', 'part05.txt']) {
  chunks.push(Buffer.from(await readFile(`.m0-bootstrap/${name}`, 'utf8'), 'base64'));
}
const files = JSON.parse(gunzipSync(Buffer.concat(chunks)).toString('utf8'));
for (const [path, content] of Object.entries(files)) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
console.log(JSON.stringify({ event: 'm0.bootstrap.materialized', files: Object.keys(files).length }));
