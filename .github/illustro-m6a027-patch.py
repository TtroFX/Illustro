from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:150]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


# Domain: canonical ordered multi-tip selection mode.
insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
export const DEFAULT_BRUSH_TIP_SELECTION_MODE_V1: BrushTipSelectionModeV1 = 'fixed';

export function brushTipSelectionModeV1(preset: BrushPresetV1): BrushTipSelectionModeV1 {
  const value = preset.tip.selectionMode;
  return value === 'sequence' || value === 'random-per-stamp'
    ? value
    : DEFAULT_BRUSH_TIP_SELECTION_MODE_V1;
}

export function withBrushTipSelectionModeV1(
  preset: BrushPresetV1,
  selectionMode: BrushTipSelectionModeV1,
): BrushPresetV1 {
  if (selectionMode !== 'fixed' && selectionMode !== 'sequence' && selectionMode !== 'random-per-stamp') {
    throw new TypeError('unsupported brush tip selection mode');
  }
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, selectionMode },
  });
}""",
)

# Kernel: choose exactly one sampled tip asset per logical stamp. No Dual Brush compositing.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export type BaselineBrushTipShapeV1 = 'round' | 'square' | 'sampled-image';

export const BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1 = 5 as const;
""",
    """export type BaselineBrushTipShapeV1 = 'round' | 'square' | 'sampled-image';
export type BaselineBrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';

export const BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1 = 5 as const;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    'export class BaselineBrushDabBuilderV1 {',
    """function deterministicBrushTipIndexV1(seed: number, stampIndex: number, count: number): number {
  let value = (seed ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value % count;
}""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #followStrokeRotation: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
  readonly #sampledTipAlpha: BaselineBrushSampledTipAlphaV1;
  #lastPoint: { x: number; y: number } | null = null;
""",
    """  readonly #followStrokeRotation: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
  readonly #sampledTipAlphas: readonly BaselineBrushSampledTipAlphaV1[];
  readonly #tipSelectionMode: BaselineBrushTipSelectionModeV1;
  readonly #tipSelectionStartIndex: number;
  readonly #tipSelectionSeed: number;
  #logicalStampIndex = 0;
  #lastPoint: { x: number; y: number } | null = null;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: readonly number[];
""",
    """      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: readonly number[];
      readonly sampledTipAlphas?: readonly (readonly number[])[];
      readonly tipSelectionMode?: BaselineBrushTipSelectionModeV1;
      readonly tipSelectionStartIndex?: number;
      readonly tipSelectionSeed?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#sampledTipAlpha = freezeBaselineBrushSampledTipAlphaV1(
      options.sampledTipAlpha ?? BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1,
    );
    this.#distanceUntilNext = this.#spacing;
""",
    """    const primarySampledTipAlpha = freezeBaselineBrushSampledTipAlphaV1(
      options.sampledTipAlpha ?? BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1,
    );
    const providedAlternatives = options.sampledTipAlphas ?? [];
    if (providedAlternatives.length > 64) {
      throw new RangeError('baseline brush sampled tip alternatives exceed 64 items');
    }
    this.#sampledTipAlphas = Object.freeze(
      providedAlternatives.length === 0
        ? [primarySampledTipAlpha]
        : providedAlternatives.map((alpha) => freezeBaselineBrushSampledTipAlphaV1(alpha)),
    );
    const tipSelectionMode = options.tipSelectionMode ?? 'fixed';
    if (
      tipSelectionMode !== 'fixed' &&
      tipSelectionMode !== 'sequence' &&
      tipSelectionMode !== 'random-per-stamp'
    ) {
      throw new TypeError('unsupported baseline brush tip selection mode');
    }
    const tipSelectionStartIndex = options.tipSelectionStartIndex ?? 0;
    if (
      !Number.isSafeInteger(tipSelectionStartIndex) ||
      tipSelectionStartIndex < 0 ||
      tipSelectionStartIndex >= this.#sampledTipAlphas.length
    ) {
      throw new RangeError('baseline brush tip selection start index is out of range');
    }
    const tipSelectionSeed = options.tipSelectionSeed ?? 0;
    if (
      !Number.isSafeInteger(tipSelectionSeed) ||
      tipSelectionSeed < 0 ||
      tipSelectionSeed > 0xffffffff
    ) {
      throw new RangeError('baseline brush tip selection seed must be uint32');
    }
    this.#tipSelectionMode = tipSelectionMode;
    this.#tipSelectionStartIndex = tipSelectionStartIndex;
    this.#tipSelectionSeed = tipSelectionSeed >>> 0;
    this.#distanceUntilNext = this.#spacing;
""",
)
# Replace three repeated low-level push blocks with one logical-stamp selector helper.
replace_once(
    'src/gpu/baseline-brush.ts',
    """    pushBaselineBrushStampV1(
      this.#dabs,
      sample.documentX,
      sample.documentY,
      this.#radius,
      this.#flow,
      this.#strokeOpacity,
      this.#hardness,
      this.#tipDensity,
      this.#resolvedTipAngleDegrees(),
      this.#color,
      this.#tipShape,
      this.#sampledTipAlpha,
    );
""",
    """    this.#pushLogicalStamp(sample.documentX, sample.documentY, this.#resolvedTipAngleDegrees());
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        pushBaselineBrushStampV1(
          this.#dabs,
          lastPoint.x,
          lastPoint.y,
          this.#radius,
          this.#flow,
          this.#strokeOpacity,
          this.#hardness,
          this.#tipDensity,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
          this.#color,
          this.#tipShape,
          this.#sampledTipAlpha,
        );
""",
    """        this.#pushLogicalStamp(
          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
        );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      pushBaselineBrushStampV1(
        this.#dabs,
        cursorX,
        cursorY,
        this.#radius,
        this.#flow,
        this.#strokeOpacity,
        this.#hardness,
        this.#tipDensity,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
        this.#color,
        this.#tipShape,
        this.#sampledTipAlpha,
      );
""",
    """      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
      );
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    '  #resolvedTipAngleDegrees(strokeDirectionDegrees?: number): number {',
    """  #sampledTipAlphaForLogicalStamp(): BaselineBrushSampledTipAlphaV1 {
    const count = this.#sampledTipAlphas.length;
    let index = this.#tipSelectionStartIndex;
    if (this.#tipSelectionMode === 'sequence') {
      index = (this.#tipSelectionStartIndex + this.#logicalStampIndex) % count;
    } else if (this.#tipSelectionMode === 'random-per-stamp') {
      index = deterministicBrushTipIndexV1(
        this.#tipSelectionSeed,
        this.#logicalStampIndex,
        count,
      );
    }
    return this.#sampledTipAlphas[index] ?? this.#sampledTipAlphas[0]!;
  }

  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number): void {
    pushBaselineBrushStampV1(
      this.#dabs,
      x,
      y,
      this.#radius,
      this.#flow,
      this.#strokeOpacity,
      this.#hardness,
      this.#tipDensity,
      tipAngleDegrees,
      this.#color,
      this.#tipShape,
      this.#sampledTipAlphaForLogicalStamp(),
    );
    this.#logicalStampIndex += 1;
  }""",
)

# Canonical facade forwards selector configuration.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipShapeV1,
""",
    """  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipSelectionModeV1,
  type BaselineBrushTipShapeV1,
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: BaselineBrushSampledTipAlphaV1;
""",
    """      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: BaselineBrushSampledTipAlphaV1;
      readonly sampledTipAlphas?: readonly BaselineBrushSampledTipAlphaV1[];
      readonly tipSelectionMode?: BaselineBrushTipSelectionModeV1;
      readonly tipSelectionStartIndex?: number;
      readonly tipSelectionSeed?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.sampledTipAlpha === undefined
        ? {}
        : { sampledTipAlpha: options.sampledTipAlpha }),
""",
    """      ...(options.sampledTipAlpha === undefined
        ? {}
        : { sampledTipAlpha: options.sampledTipAlpha }),
      ...(options.sampledTipAlphas === undefined
        ? {}
        : { sampledTipAlphas: options.sampledTipAlphas }),
      ...(options.tipSelectionMode === undefined
        ? {}
        : { tipSelectionMode: options.tipSelectionMode }),
      ...(options.tipSelectionStartIndex === undefined
        ? {}
        : { tipSelectionStartIndex: options.tipSelectionStartIndex }),
      ...(options.tipSelectionSeed === undefined
        ? {}
        : { tipSelectionSeed: options.tipSelectionSeed }),
""",
)

# Paint session: keep random seed on the committed stroke and pass resolved selector config to kernel.
replace_once(
    'src/app/paint-session-controller.ts',
    """  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipShapeV1,
""",
    """  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipSelectionModeV1,
  type BaselineBrushTipShapeV1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushMode: CanonicalBrushModeV1;
  readonly samples: readonly PaintStrokeSampleV1[];
""",
    """  readonly brushMode: CanonicalBrushModeV1;
  readonly randomSeed?: number;
  readonly samples: readonly PaintStrokeSampleV1[];
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushFollowStrokeRotation: boolean;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushFollowStrokeRotation: boolean;
  readonly brushTipSelectionMode: BaselineBrushTipSelectionModeV1;
  readonly brushTipAlternativeCount: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    'function parseStoredStrokeSample(value: unknown): PaintStrokeSampleV1 {',
    """function equalSampledTipAlphaSetsV1(
  left: readonly BaselineBrushSampledTipAlphaV1[],
  right: readonly BaselineBrushSampledTipAlphaV1[],
): boolean {
  return (
    left.length === right.length &&
    left.every((alpha, index) => equalSampledTipAlphaV1(alpha, right[index] ?? null))
  );
}

function deterministicPaintStrokeSeedV1(strokeId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < strokeId.length; index += 1) {
    hash ^= strokeId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}""",
)
# Recovery parser for optional random seed.
replace_once(
    'src/app/paint-session-controller.ts',
    """  const normalizedStroke: PaintStrokeV1 = Object.freeze({
    schema: 'illustro.paint-stroke/1' as const,
    strokeId: stroke.strokeId,
    pointerId: stroke.pointerId as number,
    source: stroke.source,
    layerId: parseLayerId(stroke.layerId),
    brushMode: storedBrushMode,
    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),
  });
""",
    """  const randomSeed =
    stroke.randomSeed === undefined
      ? undefined
      : finiteNumber(stroke.randomSeed, 'paint stroke random seed');
  if (
    randomSeed !== undefined &&
    (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff)
  ) {
    throw new RangeError('paint stroke random seed must be uint32');
  }
  const normalizedStroke: PaintStrokeV1 = Object.freeze({
    schema: 'illustro.paint-stroke/1' as const,
    strokeId: stroke.strokeId,
    pointerId: stroke.pointerId as number,
    source: stroke.source,
    layerId: parseLayerId(stroke.layerId),
    brushMode: storedBrushMode,
    ...(randomSeed === undefined ? {} : { randomSeed }),
    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),
  });
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushFollowStrokeRotation = false;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
  #brushSampledTipAlpha: BaselineBrushSampledTipAlphaV1 | null = null;
""",
    """  #brushFollowStrokeRotation = false;
  #brushTipSelectionMode: BaselineBrushTipSelectionModeV1 = 'fixed';
  #brushSampledTipAlphas: readonly BaselineBrushSampledTipAlphaV1[] = Object.freeze([]);
  #brushTipSelectionStartIndex = 0;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
  #brushSampledTipAlpha: BaselineBrushSampledTipAlphaV1 | null = null;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushFollowStrokeRotation: this.#brushFollowStrokeRotation,
      brushTipShape: this.#brushTipShape,
""",
    """      brushFollowStrokeRotation: this.#brushFollowStrokeRotation,
      brushTipSelectionMode: this.#brushTipSelectionMode,
      brushTipAlternativeCount: this.#brushSampledTipAlphas.length,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushTipSelection(
    mode: BaselineBrushTipSelectionModeV1,
    sampledTipAlphas: readonly (readonly number[])[],
    startIndex = 0,
  ): BaselineBrushTipSelectionModeV1 {
    if (mode !== 'fixed' && mode !== 'sequence' && mode !== 'random-per-stamp') {
      throw new TypeError('unsupported runtime brush tip selection mode');
    }
    if (sampledTipAlphas.length > 64) throw new RangeError('too many runtime brush tip alternatives');
    const normalized = Object.freeze(
      sampledTipAlphas.map((alpha) => freezeBaselineBrushSampledTipAlphaV1(alpha)),
    );
    const normalizedStartIndex = normalized.length === 0 ? 0 : startIndex;
    if (
      !Number.isSafeInteger(normalizedStartIndex) ||
      normalizedStartIndex < 0 ||
      (normalized.length > 0 && normalizedStartIndex >= normalized.length)
    ) {
      throw new RangeError('runtime brush tip selection start index is out of range');
    }
    if (
      mode !== this.#brushTipSelectionMode ||
      normalizedStartIndex !== this.#brushTipSelectionStartIndex ||
      !equalSampledTipAlphaSetsV1(normalized, this.#brushSampledTipAlphas)
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTipSelectionMode = mode;
    this.#brushSampledTipAlphas = normalized;
    this.#brushTipSelectionStartIndex = normalizedStartIndex;
    return this.#brushTipSelectionMode;
  }

  brushTipSelectionMode(): BaselineBrushTipSelectionModeV1 {
    return this.#brushTipSelectionMode;
  }""",
)
# Stroke start creates and stores a deterministic seed only for randomized selector mode.
replace_once(
    'src/app/paint-session-controller.ts',
    """    this.#activeSamples.length = 0;
    this.#activeSamples.push(...samples);
    this.#activeStroke = Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: crypto.randomUUID(),
      pointerId: batch.pointerId,
      source,
      layerId,
      brushMode: this.#brushMode,
      samples: Object.freeze([]),
    });
    const parameters = this.#brushParameters;
""",
    """    this.#activeSamples.length = 0;
    this.#activeSamples.push(...samples);
    const strokeId = crypto.randomUUID();
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp'
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
    this.#activeStroke = Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId,
      pointerId: batch.pointerId,
      source,
      layerId,
      brushMode: this.#brushMode,
      ...(randomSeed === undefined ? {} : { randomSeed }),
      samples: Object.freeze([]),
    });
    const parameters = this.#brushParameters;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      followStrokeRotation: this.#brushFollowStrokeRotation,
      tipDensity: this.#brushTipDensity,
      tipShape: this.#brushTipShape,
      ...(this.#brushSampledTipAlpha === null
        ? {}
        : { sampledTipAlpha: this.#brushSampledTipAlpha }),
""",
    """      followStrokeRotation: this.#brushFollowStrokeRotation,
      tipDensity: this.#brushTipDensity,
      tipShape: this.#brushTipShape,
      tipSelectionMode: this.#brushTipSelectionMode,
      tipSelectionStartIndex: this.#brushTipSelectionStartIndex,
      tipSelectionSeed: randomSeed ?? 0,
      ...(this.#brushSampledTipAlpha === null
        ? {}
        : { sampledTipAlpha: this.#brushSampledTipAlpha }),
      ...(this.#brushSampledTipAlphas.length === 0
        ? {}
        : { sampledTipAlphas: this.#brushSampledTipAlphas }),
""",
)

# Preset library selection-mode mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushFollowStrokeRotationV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushFollowStrokeRotationV1,
  withBrushTipSelectionModeV1,
  withBrushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """  type BrushTipAssetV1,
  type BrushTipShapeV1,
""",
    """  type BrushTipAssetV1,
  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTipSelectionModeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  mode: BrushTipSelectionModeV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipSelectionModeV1(item.preset, mode);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}""",
)

# UI controller: use ordered tip assets as alternatives while preserving selected asset as fixed/start anchor.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushFollowStrokeRotationV1,
  brushStrokeSpacingV1,
""",
    """  brushFollowStrokeRotationV1,
  brushTipSelectionModeV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  type BrushParameterValuesV1,
  type BrushTipShapeV1,
""",
    """  type BrushParameterValuesV1,
  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetFollowRotationV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetFollowRotationV1,
  updateBrushPresetTipSelectionModeV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const followRotationButton = requireElement('#brush-follow-rotation', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const followRotationButton = requireElement('#brush-follow-rotation', HTMLButtonElement);
  const tipRepeatMode = requireElement('#brush-tip-repeat-mode', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushTipDirectionDegrees(brushTipDirectionDegreesV1(item.preset));
    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushTipDirectionDegrees(brushTipDirectionDegreesV1(item.preset));
    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
    const tipAssets = brushTipAssetsV1(item.preset);
    const selectedTipAssetId = brushSelectedTipAssetIdV1(item.preset);
    const tipSelectionStartIndex = Math.max(
      0,
      tipAssets.findIndex((asset) => asset.id === selectedTipAssetId),
    );
    input.paintSession.setBrushTipSelection(
      brushTipSelectionModeV1(item.preset),
      tipAssets.map((asset) => asset.alpha),
      tipSelectionStartIndex,
    );
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushFollowRotation = String(
      brushFollowStrokeRotationV1(item.preset),
    );
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushFollowRotation = String(
      brushFollowStrokeRotationV1(item.preset),
    );
    input.root.dataset.illustroBrushTipSelectionMode = brushTipSelectionModeV1(item.preset);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const followRotation = brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const followRotation = brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
    const tipSelectionMode = brushTipSelectionModeV1(selected.preset);
    tipRepeatMode.value = tipSelectionMode;
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
# Avoid duplicate tipAssets declarations after moving them conceptually into runtime selection.
# render() already has its own declaration; retain it and only extend status/disabled controls.
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}`;
""",
    """    const repeatLabel =
      tipSelectionMode === 'sequence'
        ? ' · Repeat'
        : tipSelectionMode === 'random-per-stamp'
          ? ' · Random'
          : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      followRotationButton,
      tipShape,
""",
    """      followRotationButton,
      tipRepeatMode,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onFollowRotation = (): void =>
    mutate(() =>
      updateBrushPresetFollowRotationV1(
        state,
        state.selectedPresetId,
        !brushFollowStrokeRotationV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
    """  const onFollowRotation = (): void =>
    mutate(() =>
      updateBrushPresetFollowRotationV1(
        state,
        state.selectedPresetId,
        !brushFollowStrokeRotationV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipRepeatMode = (): void => {
    const mode: BrushTipSelectionModeV1 =
      tipRepeatMode.value === 'sequence'
        ? 'sequence'
        : tipRepeatMode.value === 'random-per-stamp'
          ? 'random-per-stamp'
          : 'fixed';
    mutate(() => updateBrushPresetTipSelectionModeV1(state, state.selectedPresetId, mode));
  };
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  followRotationButton.addEventListener('click', onFollowRotation);
  tipShape.addEventListener('change', onTipShape);
""",
    """  followRotationButton.addEventListener('click', onFollowRotation);
  tipRepeatMode.addEventListener('change', onTipRepeatMode);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      followRotationButton.removeEventListener('click', onFollowRotation);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      followRotationButton.removeEventListener('click', onFollowRotation);
      tipRepeatMode.removeEventListener('change', onTipRepeatMode);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-follow-rotation">ストローク追従</label>
                <button id="brush-follow-rotation" type="button" aria-pressed="false" title="ブラシ先端をストローク方向へ追従回転">OFF</button>
                <span class="shell-brush-tip-kind">回転</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-follow-rotation">ストローク追従</label>
                <button id="brush-follow-rotation" type="button" aria-pressed="false" title="ブラシ先端をストローク方向へ追従回転">OFF</button>
                <span class="shell-brush-tip-kind">回転</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-repeat-mode">先端繰り返し</label>
                <select id="brush-tip-repeat-mode" aria-label="複数ブラシ先端の繰り返し方法">
                  <option value="fixed">固定</option>
                  <option value="sequence">順番</option>
                  <option value="random-per-stamp">ランダム</option>
                </select>
                <span class="shell-brush-tip-kind">複数先端</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

write_new(
    'tests/unit/brush-stroke-repetition.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTipSelectionModeV1,
  createBaselineBrushPresetV1,
  withBrushTipSelectionModeV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

function singlePixelAlpha(index: number): readonly number[] {
  return Object.freeze(Array.from({ length: 25 }, (_, current) => (current === index ? 255 : 0)));
}

describe('M6A-027 stroke repetition', () => {
  it('keeps legacy presets fixed and exposes sequence/random-per-stamp selector modes', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'repeat.paint',
      name: 'Repeat',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipSelectionModeV1(preset)).toBe('fixed');
    expect(brushTipSelectionModeV1(withBrushTipSelectionModeV1(preset, 'sequence'))).toBe(
      'sequence',
    );
    expect(
      brushTipSelectionModeV1(withBrushTipSelectionModeV1(preset, 'random-per-stamp')),
    ).toBe('random-per-stamp');
  });

  it('repeats ordered tip alternatives once per logical stamp without Dual Brush compositing', () => {
    const top = singlePixelAlpha(2);
    const right = singlePixelAlpha(14);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top, right],
      tipSelectionMode: 'sequence',
      tipSelectionStartIndex: 0,
    });
    builder.begin({ documentX: 20, documentY: 20 });
    builder.append([{ documentX: 40, documentY: 20 }]);
    expect(builder.finish().map((dab) => [dab.x, dab.y])).toEqual([
      [20, 12],
      [38, 20],
      [40, 12],
    ]);
  });

  it('uses the selected alternative for every stamp in fixed mode', () => {
    const top = singlePixelAlpha(2);
    const right = singlePixelAlpha(14);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top, right],
      tipSelectionMode: 'fixed',
      tipSelectionStartIndex: 1,
    });
    builder.begin({ documentX: 20, documentY: 20 });
    builder.append([{ documentX: 40, documentY: 20 }]);
    expect(builder.finish().map((dab) => [dab.x, dab.y])).toEqual([
      [28, 20],
      [38, 20],
      [48, 20],
    ]);
  });

  it('makes random-per-stamp selection deterministic for an explicit stroke seed', () => {
    const alternatives = [singlePixelAlpha(2), singlePixelAlpha(14), singlePixelAlpha(22)];
    const draw = (seed: number): readonly (readonly [number, number])[] => {
      const builder = new BaselineBrushDabBuilderV1({
        sizePx: 20,
        spacingRatio: 0.25,
        tipShape: 'sampled-image',
        sampledTipAlphas: alternatives,
        tipSelectionMode: 'random-per-stamp',
        tipSelectionSeed: seed,
      });
      builder.begin({ documentX: 20, documentY: 20 });
      builder.append([{ documentX: 60, documentY: 20 }]);
      return builder.finish().map((dab) => [dab.x, dab.y] as const);
    };
    expect(draw(0x12345678)).toEqual(draw(0x12345678));
    expect(draw(0x12345678)).not.toEqual(draw(0x87654321));
  });
});""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-026 follow stroke rotation:完了
再開メモ: M6A-026 follow stroke rotationはstroke.followRotationのbooleanをpreset正本とし、falseではM6A-025の固定実効角、trueでは各新規logical stampに局所stroke tangent + tip.angleDegrees - tip.directionDegreesを適用する。開始stampはまだtangentが無いため固定角のまま確定し、後から回し直さない。短い終端stampは最後に確認した移動方向を使う。解決済みtipAngleDegreesだけをdabへ保存するためWorker/History schemaは増やさずstable-prefixを維持する。次はM6A-027 stroke repetitionから再開する。
M6A-027 stroke repetition:未完了
M6A-028 stroke-start behavior:未完了
""",
    """M6A-026 follow stroke rotation:完了
再開メモ: M6A-026 follow stroke rotationはstroke.followRotationのbooleanをpreset正本とし、falseではM6A-025の固定実効角、trueでは各新規logical stampに局所stroke tangent + tip.angleDegrees - tip.directionDegreesを適用する。開始stampはまだtangentが無いため固定角のまま確定し、後から回し直さない。短い終端stampは最後に確認した移動方向を使う。解決済みtipAngleDegreesだけをdabへ保存するためWorker/History schemaは増やさずstable-prefixを維持する。次はM6A-027 stroke repetitionから再開する。
M6A-027 stroke repetition:完了
再開メモ: M6A-027 stroke repetitionはCanonical Brush Modelのtip selection modeをfixed/sequence/random-per-stampとして実装し、M6A-020のordered tipAssetsからlogical stampごとに常に1つだけ選択する。fixedはselected asset、sequenceはselected assetを起点に順番反復、random-per-stampはstrokeId由来の保存済みuint32 randomSeedでdeterministic選択する。primitive dabは選択後の既存M6A-018 micro-dabへ解決されるためDual Brush合成や新renderer pathは追加しない。次はM6A-028 stroke-start behaviorから再開する。
M6A-028 stroke-start behavior:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A multi-tip stroke-repetition boundary — 2026-09-03',
    """#### M6A multi-tip stroke-repetition boundary — 2026-09-03

- M6A-027 implements the Canonical Brush Model tip-selection modes `fixed`, `sequence`, and `random-per-stamp` over the ordered M6A-020 tip-asset collection. This is the stroke repetition/repeat-method capability; it is not another spacing parameter.
- Exactly one tip asset contributes to each logical stamp. `fixed` uses the selected asset, `sequence` cycles through ordered assets beginning at the selected asset, and `random-per-stamp` chooses one asset from the collection for each logical stamp. No Dual Brush multiplication/compositing is introduced.
- Random selection is deterministic. When `random-per-stamp` is active, the paint stroke stores a uint32 `randomSeed`; the selector derives each stamp choice from `(seed, logicalStampIndex)` without mutable global RNG state.
- The selected asset remains the preview/fixed asset and the sequence anchor. Existing single-tip/built-in sampled brushes behave exactly as one-element collections.
- Tip selection happens before the existing sampled-tip micro-dab expansion, so history, Worker transport and canonical raster rendering continue to persist/render only resolved primitive dabs.
- The canonical release scope for this stage is the already-adopted `fixed` / `sequence` / `random-per-stamp` model. Dual Brush and independent second-brush compositing remain explicitly excluded.""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-027 stroke repetition:完了', 'M6A-027 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BrushTipSelectionModeV1',
  'multi-tip selection mode schema missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBrushTipIndexV1',
  'deterministic per-stamp tip selector missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'randomSeed',
  'randomized stroke seed is not persisted',
);
requireText(
  read('src/index.html'),
  'id=\"brush-tip-repeat-mode\"',
  'reachable stroke repetition control missing',
);
requireText(
  read('tests/unit/brush-stroke-repetition.test.ts'),
  'without Dual Brush compositing',
  'stroke repetition regression coverage missing',
);""",
)

print('M6A-027 stroke repetition patch applied')