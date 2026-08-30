import { performance } from 'node:perf_hooks';

const iterations = 250_000;
let checksum = 0x811c9dc5;
const started = performance.now();

for (let index = 0; index < iterations; index += 1) {
  checksum ^= index & 0xff;
  checksum = Math.imul(checksum, 0x01000193) >>> 0;
}

const durationMs = performance.now() - started;
console.log(
  JSON.stringify({
    benchmark: 'm0-foundation-loop',
    iterations,
    durationMs,
    checksum,
  }),
);
