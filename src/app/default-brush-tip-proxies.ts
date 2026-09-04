export const DEFAULT_BRUSH_TIP_PROXY_SCHEMA_V1 = 'illustro.default-brush-tip-proxy/1' as const;

const PROXIES: Readonly<Record<string, readonly number[]>> = Object.freeze({
  'builtin.tip.ink.06': Object.freeze([0,11,55,14,0,2,114,175,119,2,11,156,162,150,9,2,115,163,121,2,0,13,50,13,0]),
  'builtin.tip.ink.07': Object.freeze([0,8,31,7,0,5,111,156,109,4,17,151,150,148,17,4,107,146,114,4,0,8,28,7,0]),
  'builtin.tip.ink.08': Object.freeze([0,4,15,5,0,7,103,141,111,6,27,135,156,137,26,6,100,147,95,7,0,4,16,3,0]),
  'builtin.tip.pencil.01': Object.freeze([0,2,11,4,0,19,68,90,79,12,47,96,91,96,46,13,75,90,67,18,0,3,10,3,0]),
  'builtin.tip.pencil.02': Object.freeze([0,3,10,3,0,12,64,74,69,11,34,78,88,81,32,14,62,79,63,13,0,3,10,3,0]),
  'builtin.tip.pencil.03': Object.freeze([0,3,13,2,0,8,42,92,41,8,26,70,75,69,27,11,66,47,68,10,0,3,7,3,0]),
  'builtin.tip.pencil.05': Object.freeze([0,5,15,6,0,10,77,91,71,9,30,100,91,99,31,10,72,92,74,10,0,6,16,5,0]),
  'builtin.tip.pencil.08': Object.freeze([0,10,24,8,0,9,100,115,69,9,27,107,112,90,26,10,68,103,91,8,0,6,21,10,0]),
  'builtin.tip.pencil.10': Object.freeze([0,7,20,6,0,5,47,105,52,4,13,67,101,67,12,5,61,80,61,5,0,8,14,7,0]),
  'builtin.tip.paint.05': Object.freeze([0,0,3,1,0,3,85,133,85,3,22,168,180,163,23,3,83,133,84,3,0,0,3,0,0]),
  'builtin.tip.paint.07': Object.freeze([0,2,14,2,0,6,85,153,88,6,34,162,171,159,38,6,83,149,87,6,0,2,13,2,0]),
  'builtin.tip.paint.08': Object.freeze([0,0,3,0,0,2,83,137,68,2,10,143,168,144,20,2,88,125,66,2,0,0,3,0,0]),
  'builtin.tip.paint.10': Object.freeze([0,2,7,1,0,4,95,125,76,7,16,126,162,171,38,4,107,140,80,6,0,2,7,1,0]),
  'builtin.tip.paint.12': Object.freeze([0,0,3,1,0,3,85,117,67,2,12,128,155,140,28,4,84,118,65,3,0,0,3,1,0]),
  'builtin.tip.scatter.01': Object.freeze([0,0,1,0,0,0,31,152,23,0,0,142,212,149,0,0,38,142,26,0,0,0,0,0,0]),
  'builtin.tip.scatter.04': Object.freeze([0,0,0,0,0,0,19,97,18,0,0,95,126,100,1,0,17,105,20,0,0,0,0,0,0]),
  'builtin.tip.scatter.07': Object.freeze([0,0,0,0,0,0,32,116,82,0,0,166,214,94,0,0,19,149,46,0,0,0,0,0,0]),
  'builtin.tip.scatter.10': Object.freeze([0,0,0,0,0,0,24,133,64,0,0,139,214,124,0,0,56,138,26,0,0,0,0,0,0]),
  'builtin.tip.scatter.12': Object.freeze([0,0,0,0,0,0,31,67,27,0,0,66,27,70,0,0,37,68,28,0,0,0,0,0,0]),
});

for (const [alias, alpha] of Object.entries(PROXIES)) {
  if (alpha.length !== 25 || alpha.some((value) => !Number.isInteger(value) || value < 0 || value > 255) || !alpha.some((value) => value > 0)) {
    throw new TypeError(`invalid default brush tip proxy: ${alias}`);
  }
}

export function defaultBrushTipProxyAlphaV1(alias: string): readonly number[] | null {
  return PROXIES[alias] ?? null;
}

export function defaultBrushTipProxyAliasesV1(): readonly string[] {
  return Object.freeze(Object.keys(PROXIES));
}
