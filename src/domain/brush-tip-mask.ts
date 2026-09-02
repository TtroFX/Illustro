export const BRUSH_TIP_MASK_SCHEMA_V1 = 'illustro.brush-tip-mask/1' as const;
export const BRUSH_TIP_MASK_MAX_DIMENSION_V1 = 64 as const;
export const BRUSH_TIP_MASK_MAX_ASSETS_V1 = 8 as const;

export interface BrushTipMaskAssetV1 {
  readonly schema: typeof BRUSH_TIP_MASK_SCHEMA_V1;
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alphaHex: string;
}

export interface BrushTipMaskRuntimeV1 {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

function normalizedId(id: string): string {
  const value = id.trim();
  if (value.length < 1 || value.length > 160) throw new RangeError('brush tip mask id must be 1..160 characters');
  return value;
}

function byteHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

export function encodeBrushTipMaskAlphaV1(alpha: Uint8Array): string {
  let result = '';
  for (const value of alpha) result += byteHex(value);
  return result;
}

export function normalizeBrushTipMaskAssetV1(input: BrushTipMaskAssetV1): BrushTipMaskAssetV1 {
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width < 1 ||
    input.height < 1 ||
    input.width > BRUSH_TIP_MASK_MAX_DIMENSION_V1 ||
    input.height > BRUSH_TIP_MASK_MAX_DIMENSION_V1
  ) {
    throw new RangeError(`brush tip mask dimensions must be within 1..${BRUSH_TIP_MASK_MAX_DIMENSION_V1}`);
  }
  const expectedLength = input.width * input.height * 2;
  const alphaHex = input.alphaHex.toLowerCase();
  if (alphaHex.length !== expectedLength || !/^[0-9a-f]+$/.test(alphaHex)) {
    throw new TypeError('brush tip mask alphaHex does not match dimensions');
  }
  return Object.freeze({
    schema: BRUSH_TIP_MASK_SCHEMA_V1,
    id: normalizedId(input.id),
    width: input.width,
    height: input.height,
    alphaHex,
  });
}

export function createBrushTipMaskAssetV1(input: {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}): BrushTipMaskAssetV1 {
  if (input.alpha.byteLength !== input.width * input.height) {
    throw new RangeError('brush tip mask alpha byte length does not match dimensions');
  }
  return normalizeBrushTipMaskAssetV1({
    schema: BRUSH_TIP_MASK_SCHEMA_V1,
    id: input.id,
    width: input.width,
    height: input.height,
    alphaHex: encodeBrushTipMaskAlphaV1(input.alpha),
  });
}

export function decodeBrushTipMaskAssetV1(asset: BrushTipMaskAssetV1): BrushTipMaskRuntimeV1 {
  const normalized = normalizeBrushTipMaskAssetV1(asset);
  const alpha = new Uint8Array(normalized.width * normalized.height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = Number.parseInt(normalized.alphaHex.slice(index * 2, index * 2 + 2), 16);
  }
  return Object.freeze({
    id: normalized.id,
    width: normalized.width,
    height: normalized.height,
    alpha,
  });
}

function sampleInteger(mask: BrushTipMaskRuntimeV1, x: number, y: number): number {
  const clampedX = Math.max(0, Math.min(mask.width - 1, x));
  const clampedY = Math.max(0, Math.min(mask.height - 1, y));
  return (mask.alpha[clampedY * mask.width + clampedX] ?? 0) / 255;
}

export function sampleBrushTipMaskRuntimeV1(mask: BrushTipMaskRuntimeV1, u: number, v: number): number {
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || v < 0 || u > 1 || v > 1) return 0;
  const x = u * (mask.width - 1);
  const y = v * (mask.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(mask.width - 1, x0 + 1);
  const y1 = Math.min(mask.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = sampleInteger(mask, x0, y0) * (1 - tx) + sampleInteger(mask, x1, y0) * tx;
  const bottom = sampleInteger(mask, x0, y1) * (1 - tx) + sampleInteger(mask, x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

export function createBuiltInSampledBrushTipV1(): BrushTipMaskAssetV1 {
  const size = 9;
  const alpha = new Uint8Array(size * size);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const diamond = Math.abs(x - center) + Math.abs(y - center);
      alpha[y * size + x] = diamond <= 2 ? 255 : diamond === 3 ? 128 : 0;
    }
  }
  return createBrushTipMaskAssetV1({
    id: 'builtin.sampled.diamond',
    width: size,
    height: size,
    alpha,
  });
}
