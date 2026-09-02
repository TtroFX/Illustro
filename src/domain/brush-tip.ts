import { toJsonValue } from './serialization.js';
import {
  normalizeBrushPresetV1,
  type BrushPresetSectionV1,
  type BrushPresetV1,
} from './brush-schema.js';

export const BRUSH_TIP_MASK_SCHEMA_V1 = 'illustro.brush-tip-mask/1' as const;
export const BRUSH_TIP_MAX_MASK_EDGE_V1 = 64 as const;
export const BRUSH_TIP_MAX_ASSETS_V1 = 8 as const;

export type BrushProceduralTipShapeV1 = 'round' | 'square';

export interface BrushTipMaskAssetV1 {
  readonly schema: typeof BRUSH_TIP_MASK_SCHEMA_V1;
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alphaBase64: string;
}

export interface BrushProceduralTipV1 {
  readonly kind: 'procedural';
  readonly shape: BrushProceduralTipShapeV1;
  readonly hardness: number;
}

export interface BrushSampledTipV1 {
  readonly kind: 'sampled';
  readonly sequence: 'cycle';
  readonly assets: readonly BrushTipMaskAssetV1[];
}

export type BrushTipDescriptorV1 = BrushProceduralTipV1 | BrushSampledTipV1;

export const DEFAULT_BRUSH_TIP_V1: BrushTipDescriptorV1 = Object.freeze({
  kind: 'procedural' as const,
  shape: 'round' as const,
  hardness: 0.85,
});

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function normalizedHardness(value: unknown, fallback = 0.85): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function normalizedAssetId(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('brush tip asset id must be a string');
  const id = value.trim();
  if (id.length < 1 || id.length > 160) throw new RangeError('brush tip asset id is invalid');
  return id;
}

function base64Decode(text: string): Uint8Array<ArrayBuffer> {
  if (typeof globalThis.atob !== 'function') throw new Error('base64 decoding is unavailable');
  const binary = globalThis.atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export function encodeBrushTipMaskAlphaV1(bytes: Uint8Array): string {
  if (typeof globalThis.btoa !== 'function') throw new Error('base64 encoding is unavailable');
  let binary = '';
  const chunkSize = 0x4000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

export function decodeBrushTipMaskAlphaV1(asset: BrushTipMaskAssetV1): Uint8Array<ArrayBuffer> {
  const bytes = base64Decode(asset.alphaBase64);
  if (bytes.byteLength !== asset.width * asset.height) {
    throw new RangeError('brush tip alpha mask length does not match dimensions');
  }
  return bytes;
}

export function createBrushTipMaskAssetV1(input: {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}): BrushTipMaskAssetV1 {
  const id = normalizedAssetId(input.id);
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width < 1 ||
    input.height < 1 ||
    input.width > BRUSH_TIP_MAX_MASK_EDGE_V1 ||
    input.height > BRUSH_TIP_MAX_MASK_EDGE_V1 ||
    input.alpha.byteLength !== input.width * input.height
  ) {
    throw new RangeError('brush tip mask dimensions are invalid');
  }
  if (!input.alpha.some((value) => value > 0)) {
    throw new RangeError('brush tip mask must contain non-zero coverage');
  }
  const owned = new Uint8Array(input.alpha.byteLength);
  owned.set(input.alpha);
  return Object.freeze({
    schema: BRUSH_TIP_MASK_SCHEMA_V1,
    id,
    width: input.width,
    height: input.height,
    alphaBase64: encodeBrushTipMaskAlphaV1(owned),
  });
}

function normalizeMaskAssetV1(value: unknown): BrushTipMaskAssetV1 {
  const candidate = record(value);
  if (
    candidate === null ||
    candidate.schema !== BRUSH_TIP_MASK_SCHEMA_V1 ||
    !Number.isSafeInteger(candidate.width) ||
    !Number.isSafeInteger(candidate.height) ||
    (candidate.width as number) < 1 ||
    (candidate.height as number) < 1 ||
    (candidate.width as number) > BRUSH_TIP_MAX_MASK_EDGE_V1 ||
    (candidate.height as number) > BRUSH_TIP_MAX_MASK_EDGE_V1 ||
    typeof candidate.alphaBase64 !== 'string' ||
    candidate.alphaBase64.length > 8192
  ) {
    throw new TypeError('invalid sampled brush tip asset');
  }
  const asset = Object.freeze({
    schema: BRUSH_TIP_MASK_SCHEMA_V1,
    id: normalizedAssetId(candidate.id),
    width: candidate.width as number,
    height: candidate.height as number,
    alphaBase64: candidate.alphaBase64,
  });
  const bytes = decodeBrushTipMaskAlphaV1(asset);
  if (!bytes.some((entry) => entry > 0)) throw new RangeError('sampled brush tip mask is empty');
  return asset;
}

export function normalizeBrushTipDescriptorV1(value: unknown): BrushTipDescriptorV1 {
  const candidate = record(value);
  if (candidate === null) return DEFAULT_BRUSH_TIP_V1;
  if (
    candidate.kind === 'procedural-round' ||
    candidate.kind === 'procedural-square' ||
    candidate.kind === 'procedural'
  ) {
    const shape: BrushProceduralTipShapeV1 =
      candidate.kind === 'procedural-square' || candidate.shape === 'square' ? 'square' : 'round';
    return Object.freeze({
      kind: 'procedural' as const,
      shape,
      hardness: normalizedHardness(candidate.hardness),
    });
  }
  if (candidate.kind === 'sampled-image' || candidate.kind === 'sampled') {
    if (!Array.isArray(candidate.assets))
      throw new TypeError('sampled brush tip assets are missing');
    if (candidate.assets.length < 1 || candidate.assets.length > BRUSH_TIP_MAX_ASSETS_V1) {
      throw new RangeError(`sampled brush tip must contain 1..${BRUSH_TIP_MAX_ASSETS_V1} assets`);
    }
    const assets = candidate.assets.map(normalizeMaskAssetV1);
    const ids = new Set<string>();
    for (const asset of assets) {
      if (ids.has(asset.id)) throw new RangeError(`duplicate brush tip asset: ${asset.id}`);
      ids.add(asset.id);
    }
    return Object.freeze({
      kind: 'sampled' as const,
      sequence: 'cycle' as const,
      assets: Object.freeze(assets),
    });
  }
  return DEFAULT_BRUSH_TIP_V1;
}

export function brushTipDescriptorV1(preset: BrushPresetV1): BrushTipDescriptorV1 {
  try {
    return normalizeBrushTipDescriptorV1(preset.tip);
  } catch {
    return DEFAULT_BRUSH_TIP_V1;
  }
}

function tipSectionV1(tip: BrushTipDescriptorV1): BrushPresetSectionV1 {
  if (tip.kind === 'procedural') {
    return Object.freeze({
      kind: tip.shape === 'square' ? 'procedural-square' : 'procedural-round',
      hardness: tip.hardness,
    });
  }
  return Object.freeze({
    kind: 'sampled-image',
    sequence: 'cycle',
    assets: toJsonValue(tip.assets),
  });
}

export function withBrushTipDescriptorV1(
  preset: BrushPresetV1,
  descriptor: BrushTipDescriptorV1,
): BrushPresetV1 {
  const tip = normalizeBrushTipDescriptorV1(descriptor);
  return normalizeBrushPresetV1({ ...preset, tip: tipSectionV1(tip) });
}

export function appendSampledBrushTipAssetsV1(
  descriptor: BrushTipDescriptorV1,
  additions: readonly BrushTipMaskAssetV1[],
): BrushSampledTipV1 {
  const current = descriptor.kind === 'sampled' ? descriptor.assets : Object.freeze([]);
  const assets: BrushTipMaskAssetV1[] = [...current];
  const ids = new Set(assets.map((asset) => asset.id));
  for (const addition of additions) {
    const normalized = normalizeMaskAssetV1(addition);
    if (ids.has(normalized.id)) continue;
    if (assets.length >= BRUSH_TIP_MAX_ASSETS_V1) break;
    assets.push(normalized);
    ids.add(normalized.id);
  }
  if (assets.length < 1) throw new RangeError('sampled brush tip requires at least one asset');
  return Object.freeze({
    kind: 'sampled' as const,
    sequence: 'cycle' as const,
    assets: Object.freeze(assets),
  });
}
