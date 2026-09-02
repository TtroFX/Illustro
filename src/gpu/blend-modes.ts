import type { BlendModeId } from '../domain/layers.js';

export const M5C_BASE_BLEND_MODE_IDS_V1 = Object.freeze([
  'normal',
  'darken',
  'multiply',
  'color-burn',
  'linear-burn',
  'darker-color',
  'lighten',
  'screen',
  'color-dodge',
  'linear-dodge',
  'lighter-color',
  'overlay',
  'soft-light',
  'hard-light',
  'vivid-light',
  'linear-light',
  'pin-light',
  'hard-mix',
  'difference',
  'exclusion',
  'subtract',
  'divide',
] as const satisfies readonly BlendModeId[]);

export type M5cBaseBlendModeIdV1 = (typeof M5C_BASE_BLEND_MODE_IDS_V1)[number];
export type BlendRgbV1 = readonly [number, number, number];
export type BlendRgbaV1 = readonly [number, number, number, number];

const BASE_BLEND_MODE_SET = new Set<BlendModeId>(M5C_BASE_BLEND_MODE_IDS_V1);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finiteUnit(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return clamp01(value);
}

function colorBurn(backdrop: number, source: number): number {
  if (backdrop >= 1) return 1;
  if (source <= 0) return 0;
  return 1 - Math.min(1, (1 - backdrop) / source);
}

function colorDodge(backdrop: number, source: number): number {
  if (backdrop <= 0) return 0;
  if (source >= 1) return 1;
  return Math.min(1, backdrop / (1 - source));
}

function softLight(backdrop: number, source: number): number {
  if (source <= 0.5) {
    return backdrop - (1 - 2 * source) * backdrop * (1 - backdrop);
  }
  const d =
    backdrop <= 0.25 ? ((16 * backdrop - 12) * backdrop + 4) * backdrop : Math.sqrt(backdrop);
  return backdrop + (2 * source - 1) * (d - backdrop);
}

export function isM5cBaseBlendModeV1(value: unknown): value is M5cBaseBlendModeIdV1 {
  return typeof value === 'string' && BASE_BLEND_MODE_SET.has(value as BlendModeId);
}

export function blendRgbV1(
  mode: M5cBaseBlendModeIdV1,
  backdrop: BlendRgbV1,
  source: BlendRgbV1,
): BlendRgbV1 {
  const cb: BlendRgbV1 = [
    finiteUnit(backdrop[0], 'blend backdrop red'),
    finiteUnit(backdrop[1], 'blend backdrop green'),
    finiteUnit(backdrop[2], 'blend backdrop blue'),
  ];
  const cs: BlendRgbV1 = [
    finiteUnit(source[0], 'blend source red'),
    finiteUnit(source[1], 'blend source green'),
    finiteUnit(source[2], 'blend source blue'),
  ];

  if (mode === 'darker-color' || mode === 'lighter-color') {
    const backdropTotal = cb[0] + cb[1] + cb[2];
    const sourceTotal = cs[0] + cs[1] + cs[2];
    if (mode === 'darker-color') return sourceTotal < backdropTotal ? cs : cb;
    return sourceTotal > backdropTotal ? cs : cb;
  }

  const blendChannel = (backdropChannel: number, sourceChannel: number): number => {
    switch (mode) {
      case 'normal':
        return sourceChannel;
      case 'darken':
        return Math.min(backdropChannel, sourceChannel);
      case 'multiply':
        return backdropChannel * sourceChannel;
      case 'color-burn':
        return colorBurn(backdropChannel, sourceChannel);
      case 'linear-burn':
        return Math.max(0, backdropChannel + sourceChannel - 1);
      case 'lighten':
        return Math.max(backdropChannel, sourceChannel);
      case 'screen':
        return backdropChannel + sourceChannel - backdropChannel * sourceChannel;
      case 'color-dodge':
        return colorDodge(backdropChannel, sourceChannel);
      case 'linear-dodge':
        return Math.min(1, backdropChannel + sourceChannel);
      case 'overlay':
        return backdropChannel <= 0.5
          ? 2 * backdropChannel * sourceChannel
          : 1 - 2 * (1 - backdropChannel) * (1 - sourceChannel);
      case 'soft-light':
        return softLight(backdropChannel, sourceChannel);
      case 'hard-light':
        return sourceChannel <= 0.5
          ? 2 * backdropChannel * sourceChannel
          : 1 - 2 * (1 - backdropChannel) * (1 - sourceChannel);
      case 'vivid-light':
        return sourceChannel < 0.5
          ? colorBurn(backdropChannel, 2 * sourceChannel)
          : colorDodge(backdropChannel, 2 * (sourceChannel - 0.5));
      case 'linear-light':
        return clamp01(backdropChannel + 2 * sourceChannel - 1);
      case 'pin-light':
        return sourceChannel < 0.5
          ? Math.min(backdropChannel, 2 * sourceChannel)
          : Math.max(backdropChannel, 2 * sourceChannel - 1);
      case 'hard-mix':
        return backdropChannel + sourceChannel >= 1 ? 1 : 0;
      case 'difference':
        return Math.abs(backdropChannel - sourceChannel);
      case 'exclusion':
        return backdropChannel + sourceChannel - 2 * backdropChannel * sourceChannel;
      case 'subtract':
        return Math.max(0, backdropChannel - sourceChannel);
      case 'divide':
        return sourceChannel <= 0 ? 1 : Math.min(1, backdropChannel / sourceChannel);
    }
  };

  return Object.freeze([
    clamp01(blendChannel(cb[0], cs[0])),
    clamp01(blendChannel(cb[1], cs[1])),
    clamp01(blendChannel(cb[2], cs[2])),
  ]);
}

export function compositeBlendRgbaV1(
  backdrop: BlendRgbaV1,
  source: BlendRgbaV1,
  layerOpacity: number,
  mode: M5cBaseBlendModeIdV1,
): BlendRgbaV1 {
  const cb: BlendRgbV1 = [
    finiteUnit(backdrop[0], 'composite backdrop red'),
    finiteUnit(backdrop[1], 'composite backdrop green'),
    finiteUnit(backdrop[2], 'composite backdrop blue'),
  ];
  const cs: BlendRgbV1 = [
    finiteUnit(source[0], 'composite source red'),
    finiteUnit(source[1], 'composite source green'),
    finiteUnit(source[2], 'composite source blue'),
  ];
  const backdropAlpha = finiteUnit(backdrop[3], 'composite backdrop alpha');
  const sourceAlpha =
    finiteUnit(source[3], 'composite source alpha') *
    finiteUnit(layerOpacity, 'composite layer opacity');
  const outputAlpha = sourceAlpha + backdropAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return Object.freeze([0, 0, 0, 0]);

  const blended = blendRgbV1(mode, cb, cs);
  const outputChannel = (index: 0 | 1 | 2): number => {
    const blendedSource = (1 - backdropAlpha) * cs[index] + backdropAlpha * blended[index];
    const premultiplied =
      sourceAlpha * blendedSource + backdropAlpha * (1 - sourceAlpha) * cb[index];
    return clamp01(premultiplied / outputAlpha);
  };

  return Object.freeze([
    outputChannel(0),
    outputChannel(1),
    outputChannel(2),
    clamp01(outputAlpha),
  ]);
}
