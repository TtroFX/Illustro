from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, content: str) -> None:
    p = Path(path)
    text = p.read_text()
    if marker in text:
        return
    p.write_text(text.rstrip() + "\n\n" + content.strip() + "\n")


Path('src/domain/brush-tip.ts').write_text(r'''import {
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

export function decodeBrushTipMaskAlphaV1(
  asset: BrushTipMaskAssetV1,
): Uint8Array<ArrayBuffer> {
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
    if (!Array.isArray(candidate.assets)) throw new TypeError('sampled brush tip assets are missing');
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
    assets: tip.assets,
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
  return Object.freeze({ kind: 'sampled' as const, sequence: 'cycle' as const, assets: Object.freeze(assets) });
}
''')

# Baseline dab schema + deterministic tip sequencing.
replace_once(
    'src/gpu/baseline-brush.ts',
    "import {\n  CANONICAL_TILE_SIZE_PX,",
    "import {\n  DEFAULT_BRUSH_TIP_V1,\n  normalizeBrushTipDescriptorV1,\n  type BrushTipDescriptorV1,\n} from '../domain/brush-tip.js';\nimport {\n  CANONICAL_TILE_SIZE_PX,",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "  readonly strokeOpacity?: number;\n  readonly color?: BaselineBrushColorV1;\n}",
    "  readonly strokeOpacity?: number;\n  readonly color?: BaselineBrushColorV1;\n  readonly tip?: BrushTipDescriptorV1;\n  readonly tipAssetIndex?: number;\n}",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {\n  return dab.flow !== undefined || dab.strokeOpacity !== undefined;\n}\n",
    "export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {\n  return dab.flow !== undefined || dab.strokeOpacity !== undefined;\n}\n\nexport function baselineDabRequiresCanonicalTilePresentationV1(\n  dab: BaselineBrushDabV1,\n): boolean {\n  const tip = dab.tip;\n  if (tip === undefined) return false;\n  return (\n    tip.kind !== 'procedural' ||\n    tip.shape !== 'round' ||\n    Math.abs(tip.hardness - 0.85) > 1e-9\n  );\n}\n",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n): BaselineBrushDabV1 {",
    "  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n  tip?: BrushTipDescriptorV1,\n  tipAssetIndex?: number,\n): BaselineBrushDabV1 {",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    strokeOpacity,\n    color,\n  });",
    "    strokeOpacity,\n    color,\n    ...(tip === undefined ? {} : { tip }),\n    ...(tipAssetIndex === undefined ? {} : { tipAssetIndex }),\n  });",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "  readonly #strokeOpacity: number;\n  #lastPoint:",
    "  readonly #strokeOpacity: number;\n  readonly #tip: BrushTipDescriptorV1;\n  #lastPoint:",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      readonly flow?: number;\n    } = {},",
    "      readonly flow?: number;\n      readonly tip?: BrushTipDescriptorV1;\n    } = {},",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    this.#strokeOpacity = opacity;\n    this.#distanceUntilNext = this.#spacing;",
    "    this.#strokeOpacity = opacity;\n    this.#tip = normalizeBrushTipDescriptorV1(options.tip ?? DEFAULT_BRUSH_TIP_V1);\n    this.#distanceUntilNext = this.#spacing;",
)
# Replace all three direct freezeDab pushes with one sequencing helper.
replace_once(
    'src/gpu/baseline-brush.ts',
    "    this.#dabs.push(\n      freezeDab(\n        sample.documentX,\n        sample.documentY,\n        this.#radius,\n        this.#flow,\n        this.#strokeOpacity,\n        this.#color,\n      ),\n    );",
    "    this.#pushDab(sample.documentX, sample.documentY);",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "        this.#dabs.push(\n          freezeDab(\n            lastPoint.x,\n            lastPoint.y,\n            this.#radius,\n            this.#flow,\n            this.#strokeOpacity,\n            this.#color,\n          ),\n        );",
    "        this.#pushDab(lastPoint.x, lastPoint.y);",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      this.#dabs.push(\n        freezeDab(cursorX, cursorY, this.#radius, this.#flow, this.#strokeOpacity, this.#color),\n      );",
    "      this.#pushDab(cursorX, cursorY);",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "  #deltaFrom(start: number): readonly BaselineBrushDabV1[] {\n    return Object.freeze(this.#dabs.slice(start));\n  }\n\n  #appendPoint",
    "  #deltaFrom(start: number): readonly BaselineBrushDabV1[] {\n    return Object.freeze(this.#dabs.slice(start));\n  }\n\n  #pushDab(x: number, y: number): void {\n    const sequence = this.#dabs.length;\n    const tipAssetIndex =\n      this.#tip.kind === 'sampled' ? sequence % this.#tip.assets.length : undefined;\n    this.#dabs.push(\n      freezeDab(\n        x,\n        y,\n        this.#radius,\n        this.#flow,\n        this.#strokeOpacity,\n        this.#color,\n        sequence === 0 ? this.#tip : undefined,\n        tipAssetIndex,\n      ),\n    );\n  }\n\n  #appendPoint",
)

# Canonical facade accepts tip captured at stroke start.
replace_once(
    'src/app/canonical-raster-brush.ts',
    "import {\n  BaselineBrushDabBuilderV1,",
    "import type { BrushTipDescriptorV1 } from '../domain/brush-tip.js';\nimport {\n  BaselineBrushDabBuilderV1,",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      readonly flow?: number;\n    } = {},",
    "      readonly flow?: number;\n      readonly tip?: BrushTipDescriptorV1;\n    } = {},",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.flow === undefined ? {} : { flow: options.flow }),\n    });",
    "      ...(options.flow === undefined ? {} : { flow: options.flow }),\n      ...(options.tip === undefined ? {} : { tip: options.tip }),\n    });",
)

# Paint session runtime tip state + persisted dab parsing.
replace_once(
    'src/app/paint-session-controller.ts',
    "import {\n  createCanvasSpec,",
    "import {\n  DEFAULT_BRUSH_TIP_V1,\n  normalizeBrushTipDescriptorV1,\n  type BrushTipDescriptorV1,\n} from '../domain/brush-tip.js';\nimport {\n  createCanvasSpec,",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  const color =\n    value.color === undefined",
    "  const tip =\n    value.tip === undefined ? undefined : normalizeBrushTipDescriptorV1(value.tip);\n  const tipAssetIndex =\n    value.tipAssetIndex === undefined\n      ? undefined\n      : finiteNumber(value.tipAssetIndex, 'baseline dab tipAssetIndex');\n  const color =\n    value.color === undefined",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1))\n  ) {",
    "    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) ||\n    (tipAssetIndex !== undefined &&\n      (!Number.isSafeInteger(tipAssetIndex) || tipAssetIndex < 0 || tipAssetIndex >= 8))\n  ) {",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),\n    ...(color === undefined ? {} : { color }),",
    "    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),\n    ...(color === undefined ? {} : { color }),\n    ...(tip === undefined ? {} : { tip }),\n    ...(tipAssetIndex === undefined ? {} : { tipAssetIndex }),",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;\n  #disposed",
    "  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;\n  #brushTip: BrushTipDescriptorV1 = DEFAULT_BRUSH_TIP_V1;\n  #disposed",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  brushParameters(): BrushParameterValuesV1 {\n    return this.#brushParameters;\n  }\n\n  setBrushParameters",
    "  brushParameters(): BrushParameterValuesV1 {\n    return this.#brushParameters;\n  }\n\n  brushTip(): BrushTipDescriptorV1 {\n    return this.#brushTip;\n  }\n\n  setBrushTip(tip: BrushTipDescriptorV1): BrushTipDescriptorV1 {\n    this.#brushTip = normalizeBrushTipDescriptorV1(tip);\n    return this.#brushTip;\n  }\n\n  setBrushParameters",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "      flow: parameters.flow,\n    });",
    "      flow: parameters.flow,\n      tip: this.#brushTip,\n    });",
)

# Preset mutation API for tip editing.
replace_once(
    'src/app/brush-preset-library.ts',
    "import {\n  BRUSH_V1_SCHEMA,",
    "import { withBrushTipDescriptorV1, type BrushTipDescriptorV1 } from '../domain/brush-tip.js';\nimport {\n  BRUSH_V1_SCHEMA,",
)
replace_once(
    'src/app/brush-preset-library.ts',
    "export function deleteBrushPresetV1(\n",
    "export function updateBrushPresetTipV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  tip: BrushTipDescriptorV1,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushTipDescriptorV1(item.preset, tip);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({\n      ...current,\n      revision: item.preset.revision + 1,\n    });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function deleteBrushPresetV1(\n",
)

# Preset controller: image-to-mask creation, tip selection, multiple deterministic assets.
replace_once(
    'src/app/brush-preset-controller.ts',
    "import {\n  brushParameterLimitsV1,",
    "import {\n  appendSampledBrushTipAssetsV1,\n  BRUSH_TIP_MAX_ASSETS_V1,\n  BRUSH_TIP_MAX_MASK_EDGE_V1,\n  brushTipDescriptorV1,\n  createBrushTipMaskAssetV1,\n  type BrushProceduralTipShapeV1,\n  type BrushTipMaskAssetV1,\n} from '../domain/brush-tip.js';\nimport {\n  brushParameterLimitsV1,",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  updateBrushPresetParametersV1,\n  type BrushPresetLibraryStateV1,",
    "  updateBrushPresetParametersV1,\n  updateBrushPresetTipV1,\n  type BrushPresetLibraryStateV1,",
)
insert_helper = r'''
async function brushTipMaskFromFileV1(file: File): Promise<BrushTipMaskAssetV1> {
  if (!file.type.startsWith('image/')) throw new TypeError('ブラシ先端には画像ファイルを指定してください');
  if (typeof globalThis.createImageBitmap !== 'function') {
    throw new Error('このブラウザでは画像ブラシ先端を作成できません');
  }
  const bitmap = await globalThis.createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      BRUSH_TIP_MAX_MASK_EDGE_V1 / bitmap.width,
      BRUSH_TIP_MAX_MASK_EDGE_V1 / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('ブラシ先端画像を読み取れません');
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let hasTransparency = false;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      if ((pixels[offset] ?? 255) < 250) {
        hasTransparency = true;
        break;
      }
    }
    const alpha = new Uint8Array(width * height);
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      const offset = pixel * 4;
      const red = pixels[offset] ?? 0;
      const green = pixels[offset + 1] ?? 0;
      const blue = pixels[offset + 2] ?? 0;
      const sourceAlpha = pixels[offset + 3] ?? 0;
      const luminance = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
      alpha[pixel] = hasTransparency ? sourceAlpha : 255 - luminance;
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', alpha));
    const hash = [...digest.slice(0, 10)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return createBrushTipMaskAssetV1({ id: `user-tip-${hash}`, width, height, alpha });
  } finally {
    bitmap.close();
  }
}
'''
replace_once(
    'src/app/brush-preset-controller.ts',
    "function modeForBehavior(behavior: BrushBehaviorV1): 'raster' | 'eraser' | 'smudge' | 'blur' {\n  return behavior === 'paint' ? 'raster' : behavior === 'erase' ? 'eraser' : behavior;\n}\n",
    "function modeForBehavior(behavior: BrushBehaviorV1): 'raster' | 'eraser' | 'smudge' | 'blur' {\n  return behavior === 'paint' ? 'raster' : behavior === 'erase' ? 'eraser' : behavior;\n}\n" + insert_helper,
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);\n  let state",
    "  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);\n  const tipKind = requireElement('#brush-tip-kind', HTMLSelectElement);\n  const tipImport = requireElement('#brush-tip-import', HTMLInputElement);\n  const tipRemove = requireElement('#brush-tip-remove', HTMLButtonElement);\n  const tipStatus = requireElement('#brush-tip-status', HTMLOutputElement);\n  let state",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    input.paintSession.setBrushParameters(parameters);",
    "    input.paintSession.setBrushParameters(parameters);\n    input.paintSession.setBrushTip(brushTipDescriptorV1(item.preset));",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;\n\n    const locked",
    "    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;\n    const tip = brushTipDescriptorV1(selected.preset);\n    tipKind.value = tip.kind === 'sampled' ? 'sampled' : tip.shape;\n    tipStatus.textContent =\n      tip.kind === 'sampled'\n        ? `画像 ${tip.assets.length}/${BRUSH_TIP_MAX_ASSETS_V1} · dabごとに順送り`\n        : tip.shape === 'square'\n          ? '解析的・角型'\n          : '解析的・丸型';\n    tipRemove.disabled = selected.locked || tip.kind !== 'sampled';\n    tipImport.disabled = selected.locked;\n    tipKind.disabled = selected.locked;\n\n    const locked",
)
# Add handlers before event registration.
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });\n\n  search.addEventListener",
    r'''  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });
  const onTipKind = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const current = brushTipDescriptorV1(selected.preset);
    if (tipKind.value === 'sampled') {
      if (current.kind !== 'sampled') {
        tipStatus.textContent = '画像を追加すると画像先端へ切り替わります';
        render();
      }
      return;
    }
    const shape = tipKind.value as BrushProceduralTipShapeV1;
    const hardness = current.kind === 'procedural' ? current.hardness : 0.85;
    mutate(() =>
      updateBrushPresetTipV1(state, state.selectedPresetId, {
        kind: 'procedural',
        shape,
        hardness,
      }),
    );
  };
  const onTipImport = async (): Promise<void> => {
    const files = Array.from(tipImport.files ?? []);
    if (files.length === 0) return;
    try {
      const selected = selectedBrushPresetItemV1(state);
      if (selected.locked) throw new Error('locked brush preset cannot be edited');
      const additions: BrushTipMaskAssetV1[] = [];
      for (const file of files.slice(0, BRUSH_TIP_MAX_ASSETS_V1)) {
        additions.push(await brushTipMaskFromFileV1(file));
      }
      const nextTip = appendSampledBrushTipAssetsV1(
        brushTipDescriptorV1(selected.preset),
        additions,
      );
      state = updateBrushPresetTipV1(state, selected.preset.id, nextTip);
      persist();
      applySelected();
      render();
    } catch (error) {
      tipStatus.textContent = error instanceof Error ? error.message : '画像先端の作成に失敗しました';
    } finally {
      tipImport.value = '';
    }
  };
  const onTipRemove = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const current = brushTipDescriptorV1(selected.preset);
    if (current.kind !== 'sampled') return;
    if (current.assets.length <= 1) {
      mutate(() =>
        updateBrushPresetTipV1(state, selected.preset.id, {
          kind: 'procedural',
          shape: 'round',
          hardness: 0.85,
        }),
      );
      return;
    }
    mutate(() =>
      updateBrushPresetTipV1(state, selected.preset.id, {
        ...current,
        assets: Object.freeze(current.assets.slice(0, -1)),
      }),
    );
  };

  search.addEventListener''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  flowNumber.addEventListener('change', onFlowNumber);\n\n  applySelected();",
    "  flowNumber.addEventListener('change', onFlowNumber);\n  tipKind.addEventListener('change', onTipKind);\n  tipImport.addEventListener('change', () => void onTipImport());\n  tipRemove.addEventListener('click', onTipRemove);\n\n  applySelected();",
)
# Store the exact wrapper so it can be removed in dispose.
replace_once(
    'src/app/brush-preset-controller.ts',
    "  tipKind.addEventListener('change', onTipKind);\n  tipImport.addEventListener('change', () => void onTipImport());\n  tipRemove.addEventListener('click', onTipRemove);",
    "  const onTipImportChange = (): void => void onTipImport();\n  tipKind.addEventListener('change', onTipKind);\n  tipImport.addEventListener('change', onTipImportChange);\n  tipRemove.addEventListener('click', onTipRemove);",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      flowNumber.removeEventListener('change', onFlowNumber);\n    },",
    "      flowNumber.removeEventListener('change', onFlowNumber);\n      tipKind.removeEventListener('change', onTipKind);\n      tipImport.removeEventListener('change', onTipImportChange);\n      tipRemove.removeEventListener('click', onTipRemove);\n    },",
)

# Reachable Tip UI under existing Tool Properties card.
replace_once(
    'src/index.html',
    "            </div>\n          </section>\n          <section class=\"shell-inspector-card shell-color-panel\" aria-label=\"カラー\">",
    "            </div>\n            <fieldset class=\"shell-brush-tip-controls\"><legend>ブラシ先端</legend>\n              <label class=\"shell-brush-tip-kind\">種類\n                <select id=\"brush-tip-kind\" aria-label=\"ブラシ先端の種類\">\n                  <option value=\"round\">丸</option>\n                  <option value=\"square\">角</option>\n                  <option value=\"sampled\">画像</option>\n                </select>\n              </label>\n              <div class=\"shell-brush-tip-actions\">\n                <label class=\"shell-brush-tip-import\">画像追加<input id=\"brush-tip-import\" type=\"file\" accept=\"image/png,image/jpeg,image/webp\" multiple /></label>\n                <button id=\"brush-tip-remove\" type=\"button\">最後を削除</button>\n              </div>\n              <output id=\"brush-tip-status\" class=\"shell-brush-tip-status\" aria-live=\"polite\"></output>\n            </fieldset>\n          </section>\n          <section class=\"shell-inspector-card shell-color-panel\" aria-label=\"カラー\">",
)

append_once(
    'public/app-shell.css',
    '/* M6A Brush Tip controls */',
    r'''
/* M6A Brush Tip controls — compact inspector treatment matching the canonical brush settings card. */
.shell-brush-tip-controls {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 2px 0 0;
  padding: 9px;
  border: 1px solid #e4eaf3;
  border-radius: 10px;
  background: #fbfdff;
}

.shell-brush-tip-controls > legend {
  padding: 0 5px;
  color: #52627a;
  font-size: 10px;
  font-weight: 750;
}

.shell-brush-tip-kind {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #24334b;
  font-size: 11px;
}

.shell-brush-tip-kind select,
.shell-brush-tip-actions button,
.shell-brush-tip-import {
  min-height: 34px;
  border: 1px solid #dfe7f3;
  border-radius: 9px;
  background: #fff;
  color: #30405a;
  font: 650 10px/1 system-ui, sans-serif;
}

.shell-brush-tip-kind select {
  min-width: 0;
  padding: 0 8px;
}

.shell-brush-tip-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
}

.shell-brush-tip-actions button,
.shell-brush-tip-import {
  display: grid;
  place-items: center;
  padding: 0 8px;
  cursor: pointer;
}

.shell-brush-tip-import input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.shell-brush-tip-actions button:disabled,
.shell-brush-tip-import:has(input:disabled),
.shell-brush-tip-kind select:disabled {
  cursor: default;
  opacity: 0.45;
}

.shell-brush-tip-status {
  min-height: 12px;
  color: #66758d;
  font-size: 9px;
}
''',
)

# Rasterization: active tip context, procedural round/square, sampled bilinear coverage.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
    "import {\n  decodeBrushTipMaskAlphaV1,\n  DEFAULT_BRUSH_TIP_V1,\n  normalizeBrushTipDescriptorV1,\n  type BrushTipDescriptorV1,\n  type BrushTipMaskAssetV1,\n} from '../domain/brush-tip.js';\nimport type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "interface ActiveTileTransactionV1 {\n",
    "interface BaselineBrushTipRasterAssetV1 {\n  readonly descriptor: BrushTipMaskAssetV1;\n  readonly alpha: Uint8Array<ArrayBuffer>;\n}\n\ninterface BaselineBrushTipRasterContextV1 {\n  readonly tip: BrushTipDescriptorV1;\n  readonly sampledAssets: readonly BaselineBrushTipRasterAssetV1[];\n}\n\ninterface ActiveTileTransactionV1 {\n",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  readonly paintCoverage: Map<string, Float32Array>;\n  paintStrokeOpacity:",
    "  readonly paintCoverage: Map<string, Float32Array>;\n  readonly tipContext: BaselineBrushTipRasterContextV1;\n  paintStrokeOpacity:",
)
# Insert tip coverage helpers in place of old hardness constants.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "const BASELINE_BRUSH_HARDNESS = 0.85;\nconst BASELINE_BRUSH_HARDNESS_SQUARED = BASELINE_BRUSH_HARDNESS * BASELINE_BRUSH_HARDNESS;\n",
    r'''function createBrushTipRasterContextV1(tipInput: BrushTipDescriptorV1): BaselineBrushTipRasterContextV1 {
  const tip = normalizeBrushTipDescriptorV1(tipInput);
  const sampledAssets =
    tip.kind === 'sampled'
      ? Object.freeze(
          tip.assets.map((descriptor) =>
            Object.freeze({ descriptor, alpha: decodeBrushTipMaskAlphaV1(descriptor) }),
          ),
        )
      : Object.freeze([]);
  return Object.freeze({ tip, sampledAssets });
}

function sampleBrushTipMaskV1(
  asset: BaselineBrushTipRasterAssetV1,
  localX: number,
  localY: number,
): number {
  if (Math.abs(localX) >= 1 || Math.abs(localY) >= 1) return 0;
  const x = ((localX + 1) * 0.5) * (asset.descriptor.width - 1);
  const y = ((localY + 1) * 0.5) * (asset.descriptor.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(asset.descriptor.width - 1, x0 + 1);
  const y1 = Math.min(asset.descriptor.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const sample = (sx: number, sy: number): number =>
    (asset.alpha[sy * asset.descriptor.width + sx] ?? 0) / 255;
  const top = sample(x0, y0) + (sample(x1, y0) - sample(x0, y0)) * tx;
  const bottom = sample(x0, y1) + (sample(x1, y1) - sample(x0, y1)) * tx;
  return clamp01(top + (bottom - top) * ty);
}

function brushTipCoverageV1(
  context: BaselineBrushTipRasterContextV1,
  dab: BaselineBrushDabV1,
  localX: number,
  localY: number,
): number {
  if (Math.abs(localX) >= 1 || Math.abs(localY) >= 1) return 0;
  if (context.tip.kind === 'sampled') {
    const index = dab.tipAssetIndex ?? 0;
    const asset = context.sampledAssets[index % context.sampledAssets.length];
    return asset === undefined ? 0 : sampleBrushTipMaskV1(asset, localX, localY);
  }
  const distance =
    context.tip.shape === 'square' ? Math.max(Math.abs(localX), Math.abs(localY)) : Math.hypot(localX, localY);
  if (distance >= 1) return 0;
  const hardness = context.tip.hardness;
  if (hardness >= 1 || distance <= hardness) return 1;
  return clamp01(1 - smoothstep(hardness, 1, distance));
}
''',
)
# Add tip context to rasterizer signatures.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  dab: BaselineBrushDabV1,\n  strokeCoverage: Float32Array | null = null,\n): void {",
    "  dab: BaselineBrushDabV1,\n  tipContext: BaselineBrushTipRasterContextV1,\n  strokeCoverage: Float32Array | null = null,\n): void {",
)
# Two color loops: remove radial-only clipping and use shared coverage.
for _ in range(2):
    replace_once(
        'src/gpu/baseline-raster-tile-store.ts',
        "    const localYSquared = localY * localY;\n    if (localYSquared >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const tipCoverage =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? 1\n          : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared)));",
        "    if (Math.abs(localY) >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const tipCoverage = brushTipCoverageV1(tipContext, dab, localX, localY);\n      if (tipCoverage <= 0) continue;",
    )
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  dab: BaselineBrushDabV1,\n): void {\n  const radiusX = baselineDabRadiusXV1(dab);",
    "  dab: BaselineBrushDabV1,\n  tipContext: BaselineBrushTipRasterContextV1,\n): void {\n  const radiusX = baselineDabRadiusXV1(dab);",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "    const localYSquared = localY * localY;\n    if (localYSquared >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const eraseAlpha =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? opacity\n          : clamp01(\n              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),\n            );",
    "    if (Math.abs(localY) >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const eraseAlpha = clamp01(opacity * brushTipCoverageV1(tipContext, dab, localX, localY));",
)
# Smudge and blur signatures + loop strength, one each.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  dab: BaselineBrushDabV1,\n  deltaX: number,",
    "  dab: BaselineBrushDabV1,\n  tipContext: BaselineBrushTipRasterContextV1,\n  deltaX: number,",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "    const localYSquared = localY * localY;\n    if (localYSquared >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const strength =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? opacity\n          : clamp01(\n              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),\n            );",
    "    if (Math.abs(localY) >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const strength = clamp01(opacity * brushTipCoverageV1(tipContext, dab, localX, localY));",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  dab: BaselineBrushDabV1,\n  snapshot: BaselineSmudgeSourceSnapshotV1,",
    "  dab: BaselineBrushDabV1,\n  tipContext: BaselineBrushTipRasterContextV1,\n  snapshot: BaselineSmudgeSourceSnapshotV1,",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "    const localYSquared = localY * localY;\n    if (localYSquared >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const strength =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? opacity\n          : clamp01(\n              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),\n            );",
    "    if (Math.abs(localY) >= 1) continue;\n    for (let documentX = minX; documentX <= maxX; documentX += 1) {\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const strength = clamp01(opacity * brushTipCoverageV1(tipContext, dab, localX, localY));",
)
# Active transaction tip capture.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "    if (this.#active === null) {\n      this.#active = {",
    "    const declaredTip = dabs.find((dab) => dab.tip !== undefined)?.tip;\n    if (this.#active === null) {\n      this.#active = {",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "        paintCoverage: new Map(),\n        paintStrokeOpacity: null,",
    "        paintCoverage: new Map(),\n        tipContext: createBrushTipRasterContextV1(declaredTip ?? DEFAULT_BRUSH_TIP_V1),\n        paintStrokeOpacity: null,",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "    if (this.#active.operation !== operation)\n      throw new Error('active stroke changed brush operation');",
    "    if (this.#active.operation !== operation)\n      throw new Error('active stroke changed brush operation');\n    if (\n      declaredTip !== undefined &&\n      JSON.stringify(normalizeBrushTipDescriptorV1(declaredTip)) !== JSON.stringify(this.#active.tipContext.tip)\n    ) {\n      throw new Error('active stroke changed brush tip');\n    }",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);\n        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage);",
    "        if (operation === 'erase')\n          rasterizeEraseDab(tile, bounds.x, bounds.y, dab, this.#active.tipContext);\n        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, this.#active.tipContext, coverage);",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "          dab,\n          deltaX,",
    "          dab,\n          active.tipContext,\n          deltaX,",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "          dab,\n          snapshot,\n          this.#documentWidth,",
    "          dab,\n          active.tipContext,\n          snapshot,\n          this.#documentWidth,",
)

# Renderer retains custom-tip presentation state and preserves dab metadata.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "  baselineDabColorV1,",
    "  baselineDabColorV1,\n  baselineDabRequiresCanonicalTilePresentationV1,",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "  readonly operation: BaselineBrushCompositeOperationV1;\n  readonly dabs:",
    "  readonly operation: BaselineBrushCompositeOperationV1;\n  canonicalTilePresentation: boolean;\n  readonly dabs:",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "        ...(dab.color === undefined\n          ? {}\n          : { color: Object.freeze([...dab.color]) as readonly [number, number, number] }),",
    "        ...(dab.color === undefined\n          ? {}\n          : { color: Object.freeze([...dab.color]) as readonly [number, number, number] }),\n        ...(dab.tip === undefined ? {} : { tip: dab.tip }),\n        ...(dab.tipAssetIndex === undefined ? {} : { tipAssetIndex: dab.tipAssetIndex }),",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "    Number.isFinite(dab.opacity) &&\n    dab.opacity >= 0 &&\n    dab.opacity <= 1",
    "    Number.isFinite(dab.opacity) &&\n    dab.opacity >= 0 &&\n    dab.opacity <= 1 &&\n    (dab.tipAssetIndex === undefined ||\n      (Number.isSafeInteger(dab.tipAssetIndex) && dab.tipAssetIndex >= 0 && dab.tipAssetIndex < 8))",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "    left.opacity === right.opacity &&\n    baselineDabColorV1(left).every(",
    "    left.opacity === right.opacity &&\n    left.tipAssetIndex === right.tipAssetIndex &&\n    JSON.stringify(left.tip ?? null) === JSON.stringify(right.tip ?? null) &&\n    baselineDabColorV1(left).every(",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "      this.#activeStroke = { strokeId, operation, dabs: [] };",
    "      this.#activeStroke = {\n        strokeId,\n        operation,\n        canonicalTilePresentation: delta.some(baselineDabRequiresCanonicalTilePresentationV1),\n        dabs: [],\n      };",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "    this.#activeStroke.dabs.push(...delta);\n    if (delta.length > 0) {\n      if (operation !== 'paint') {",
    "    this.#activeStroke.dabs.push(...delta);\n    if (delta.some(baselineDabRequiresCanonicalTilePresentationV1)) {\n      this.#activeStroke.canonicalTilePresentation = true;\n    }\n    if (delta.length > 0) {\n      if (operation !== 'paint' || this.#activeStroke.canonicalTilePresentation) {",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "        if (operation !== 'paint') {\n          this.#patchCompositeTiles(",
    "        if (operation !== 'paint' || active.canonicalTilePresentation) {\n          this.#patchCompositeTiles(",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };",
    "      this.#activeStroke = {\n        strokeId,\n        operation,\n        canonicalTilePresentation: frozenDabs.some(baselineDabRequiresCanonicalTilePresentationV1),\n        dabs: [...frozenDabs],\n      };",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "        if (operation !== 'paint') {\n          this.#patchCompositeTiles(\n            planBaselineBrushTilesV1(frozenDabs, width, height)",
    "        if (operation !== 'paint' || this.#activeStroke.canonicalTilePresentation) {\n          this.#patchCompositeTiles(\n            planBaselineBrushTilesV1(frozenDabs, width, height)",
)

# Compatibility fallback tracks sampled/procedural non-default tip strokes as canonical-tile presentation.
replace_once(
    'src/app/renderer-controller.ts',
    "  planBaselineBrushTilesV1,",
    "  baselineDabRequiresCanonicalTilePresentationV1,\n  planBaselineBrushTilesV1,",
)
replace_once(
    'src/app/renderer-controller.ts',
    "  readonly #compatibilityActiveTiles = new Map<string, TileCoordinateV1>();\n",
    "  readonly #compatibilityActiveTiles = new Map<string, TileCoordinateV1>();\n  readonly #compatibilityCanonicalStrokeIds = new Set<string>();\n",
)
replace_once(
    'src/app/renderer-controller.ts',
    "    if (snapshot.owner === 'compatibility') {\n      this.#trackCompatibilityDabs(dabs);\n      if (operation !== 'paint') {",
    "    if (snapshot.owner === 'compatibility') {\n      this.#trackCompatibilityDabs(dabs);\n      if (dabs.some(baselineDabRequiresCanonicalTilePresentationV1)) {\n        this.#compatibilityCanonicalStrokeIds.add(strokeId);\n      }\n      if (operation !== 'paint' || this.#compatibilityCanonicalStrokeIds.has(strokeId)) {",
)
replace_once(
    'src/app/renderer-controller.ts',
    "    this.#compatibilityActiveTiles.clear();\n    if (snapshot.owner === 'compatibility') this.#syncCompatibilityTiles(affected);",
    "    this.#compatibilityActiveTiles.clear();\n    this.#compatibilityCanonicalStrokeIds.delete(strokeId);\n    if (snapshot.owner === 'compatibility') this.#syncCompatibilityTiles(affected);",
)
replace_once(
    'src/app/renderer-controller.ts',
    "    this.#compatibilityActiveTiles.clear();\n    if (snapshot.owner === 'compatibility') {\n      this.#syncCompatibilityTiles(finalization.affectedTiles.map((entry) => entry.coordinate));",
    "    this.#compatibilityActiveTiles.clear();\n    this.#compatibilityCanonicalStrokeIds.delete(strokeId);\n    if (snapshot.owner === 'compatibility') {\n      this.#syncCompatibilityTiles(finalization.affectedTiles.map((entry) => entry.coordinate));",
)
replace_once(
    'src/app/renderer-controller.ts',
    "    this.#compatibilityPresenter.dispose();\n    this.#compatibilityActiveTiles.clear();",
    "    this.#compatibilityPresenter.dispose();\n    this.#compatibilityActiveTiles.clear();\n    this.#compatibilityCanonicalStrokeIds.clear();",
)

# Worker input validates and preserves tip descriptor/index.
replace_once(
    'src/workers/render.worker.ts',
    "import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';",
    "import { normalizeBrushTipDescriptorV1 } from '../domain/brush-tip.js';\nimport type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';",
)
replace_once(
    'src/workers/render.worker.ts',
    "    let color: readonly [number, number, number] | undefined;\n    if (candidate.color !== undefined) {",
    "    let tip;\n    if (candidate.tip !== undefined) {\n      try {\n        tip = normalizeBrushTipDescriptorV1(candidate.tip);\n      } catch {\n        return null;\n      }\n    }\n    const tipAssetIndex = candidate.tipAssetIndex;\n    if (\n      tipAssetIndex !== undefined &&\n      (!Number.isSafeInteger(tipAssetIndex) || (tipAssetIndex as number) < 0 || (tipAssetIndex as number) >= 8)\n    ) {\n      return null;\n    }\n    let color: readonly [number, number, number] | undefined;\n    if (candidate.color !== undefined) {",
)
replace_once(
    'src/workers/render.worker.ts',
    "        ...(color === undefined ? {} : { color }),\n      }),",
    "        ...(color === undefined ? {} : { color }),\n        ...(tip === undefined ? {} : { tip }),\n        ...(tipAssetIndex === undefined ? {} : { tipAssetIndex: tipAssetIndex as number }),\n      }),",
)

# Tests exercise canonical descriptor, mask coverage, cycling and preset persistence.
Path('tests/unit/brush-tip.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  appendSampledBrushTipAssetsV1,
  brushTipDescriptorV1,
  createBrushTipMaskAssetV1,
  decodeBrushTipMaskAlphaV1,
} from '../../src/domain/brush-tip.js';
import { createBaselineBrushPresetV1 } from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';
import {
  createBrushPresetLibraryStateV1,
  selectedBrushPresetItemV1,
  updateBrushPresetTipV1,
} from '../../src/app/brush-preset-library.js';

describe('M6A-017..020 brush tip system', () => {
  it('normalizes legacy procedural-round preset data into canonical procedural semantics', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'tip.round',
      name: 'Round',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipDescriptorV1(preset)).toEqual({
      kind: 'procedural',
      shape: 'round',
      hardness: 0.85,
    });
  });

  it('round-trips bounded 8-bit sampled masks', () => {
    const asset = createBrushTipMaskAssetV1({
      id: 'mask.a',
      width: 2,
      height: 2,
      alpha: new Uint8Array([255, 128, 64, 1]),
    });
    expect([...decodeBrushTipMaskAlphaV1(asset)]).toEqual([255, 128, 64, 1]);
  });

  it('cycles multiple sampled assets one at a time without Dual Brush compositing', () => {
    const a = createBrushTipMaskAssetV1({
      id: 'mask.a',
      width: 1,
      height: 1,
      alpha: new Uint8Array([255]),
    });
    const b = createBrushTipMaskAssetV1({
      id: 'mask.b',
      width: 1,
      height: 1,
      alpha: new Uint8Array([128]),
    });
    const tip = appendSampledBrushTipAssetsV1(
      { kind: 'procedural', shape: 'round', hardness: 0.85 },
      [a, b],
    );
    const builder = new BaselineBrushDabBuilderV1({ tip });
    builder.beginDelta({ documentX: 8, documentY: 8 });
    builder.appendDelta([{ documentX: 16, documentY: 8 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.tipAssetIndex)).toEqual([0, 1, 0]);
    expect(dabs[0]?.tip).toEqual(tip);
    expect(dabs[1]?.tip).toBeUndefined();
  });

  it('uses sampled mask coverage in canonical Raster Tile paint', () => {
    const asset = createBrushTipMaskAssetV1({
      id: 'mask.corner',
      width: 2,
      height: 2,
      alpha: new Uint8Array([255, 0, 0, 1]),
    });
    const tip = { kind: 'sampled' as const, sequence: 'cycle' as const, assets: [asset] };
    const builder = new BaselineBrushDabBuilderV1({ sizePx: 16, tip });
    const dabs = builder.beginDelta({ documentX: 8, documentY: 8 });
    const store = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.applyDabs('layer', 'stroke', dabs, 'paint');
    store.finalize('stroke');
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const topLeft = readBaselineRasterTilePixelV1(tile!, 2 * 16 + 2)[3];
    const bottomRight = readBaselineRasterTilePixelV1(tile!, 13 * 16 + 13)[3];
    expect(topLeft).toBeGreaterThan(bottomRight);
  });

  it('persists a user-selected sampled tip as a normal Modified preset value', () => {
    const asset = createBrushTipMaskAssetV1({
      id: 'mask.persist',
      width: 1,
      height: 1,
      alpha: new Uint8Array([255]),
    });
    let state = createBrushPresetLibraryStateV1();
    state = updateBrushPresetTipV1(state, state.selectedPresetId, {
      kind: 'sampled',
      sequence: 'cycle',
      assets: [asset],
    });
    const selected = selectedBrushPresetItemV1(state);
    expect(selected.modified).toBe(true);
    expect(brushTipDescriptorV1(selected.preset)).toMatchObject({ kind: 'sampled' });
  });
});
''')

# Progress + verification + design source of truth.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    "M6A-017 procedural tip:未完了\nM6A-018 sampled image tip:未完了\nM6A-019 custom tip creation:未完了\nM6A-020 multiple tip assets without Dual Brush semantics:未完了",
    "M6A-017 procedural tip:完了\nM6A-018 sampled image tip:完了\nM6A-019 custom tip creation:完了\nM6A-020 multiple tip assets without Dual Brush semantics:完了\n再開メモ: M6A-017〜020 Brush Tipはstroke開始時にtip descriptorをcaptureし、procedural round/squareは解析的coverage、sampled imageは最大64×64の8-bit alpha maskとしてcanonical Raster Tileへ適用する。画像importは透過画像ではalpha、完全不透明画像では暗さをcoverageとしてmask化し、raw画像自体は保存しない。sampled assetは最大8個で、各dabは1 assetだけを決定論的に順送りするためDual Brushの同時合成にはしない。非default tipのinteractive previewはGPU丸ブラシshaderへ近似せずcanonical changed Tileをpatchして最終結果と一致させる。次はM6A-021 hardnessから再開する。",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A brush-tip semantic boundary — 2026-09-03',
    r'''
#### M6A brush-tip semantic boundary — 2026-09-03

- Brush-tip identity is captured at stroke start together with the existing size/opacity/flow state; changing a preset while a stroke is active does not reinterpret its stable dab prefix.
- The canonical procedural-tip baseline supports analytic `round` and `square` coverage. The stored legacy `procedural-round` form remains readable and normalizes into this descriptor model.
- A sampled image tip is stored as a bounded 8-bit coverage mask, currently at most 64×64 pixels per asset and at most 8 assets per preset. Raw imported image bytes are not retained in the brush preset.
- Custom-tip image creation uses source alpha when the imported image contains transparency. For fully opaque source images, darkness is interpreted as brush coverage so conventional black-on-white brush-tip artwork imports predictably.
- Multiple tip assets mean deterministic per-dab cycling: one sampled asset is selected for each dab. They are never composited together, so this capability does not reintroduce the explicitly excluded Dual Brush feature.
- Default round/0.85-hardness paint may continue through the incremental GPU dab presentation path. Any non-default procedural or sampled tip presents from the canonical changed Raster Tiles rather than being approximated by the round preview shader; final and interactive semantics therefore remain identical across Worker, main-WebGPU and compatibility fallback paths.
- The sampled mask payload is intentionally a bounded preset-embedded canonical representation at this stage. M6A-072 may deduplicate/externalize these masks into the final brush-tip resource manager without changing tip semantics or brush-preset identity.
''',
)
replace_once(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    "for (const item of [\n  'M6A-017 procedural tip:完了',\n  'M6A-018 sampled image tip:完了',\n  'M6A-019 custom tip creation:完了',\n  'M6A-020 multiple tip assets without Dual Brush semantics:完了',\n]) {\n  requireText(progress, item, `${item.split(':')[0]} progress is not complete`);\n}\nrequireText(read('src/domain/brush-tip.ts'), 'BRUSH_TIP_MAX_MASK_EDGE_V1', 'bounded brush-tip mask contract missing');\nrequireText(read('src/gpu/baseline-raster-tile-store.ts'), 'brushTipCoverageV1', 'canonical brush-tip coverage missing');\nrequireText(read('src/app/paint-session-controller.ts'), 'setBrushTip', 'production brush-tip state is not connected');\nrequireText(read('src/index.html'), 'id=\"brush-tip-import\"', 'reachable custom-tip image creation UI missing');\nrequireText(read('tests/unit/brush-tip.test.ts'), 'without Dual Brush compositing', 'multiple-tip regression coverage missing');\nrequireText(progress, 'M6A-021 hardness:未完了', 'hardness was incorrectly advanced');\nrequireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
)

print('M6A brush tips patch applied')
