from pathlib import Path


def replace_once(path_s: str, old: str, new: str) -> None:
    path = Path(path_s)
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path_s}: expected exactly one anchor, found {count}: {old[:120]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path_s: str, marker: str, addition: str) -> None:
    path = Path(path_s)
    text = path.read_text(encoding='utf-8')
    if addition.strip() in text:
        raise SystemExit(f'{path_s}: addition already present')
    count = text.count(marker)
    if count != 1:
        raise SystemExit(f'{path_s}: expected one append marker, found {count}')
    path.write_text(text.replace(marker, marker + addition, 1), encoding='utf-8')

replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';\n",
    """export const DEFAULT_BRUSH_COLOR_MIX_ENABLED_V1 = false as const;
export const DEFAULT_BRUSH_COLOR_MIX_CANVAS_RATIO_V1 = 0.5 as const;
export const DEFAULT_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1 = 1 as const;

export function brushColorMixEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.colorMix.enabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_COLOR_MIX_ENABLED_V1;
}

function brushColorMixUnitValueV1(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fallback;
}

export function brushColorMixCanvasRatioV1(preset: BrushPresetV1): number {
  return brushColorMixUnitValueV1(
    preset.colorMix.canvasRatio,
    DEFAULT_BRUSH_COLOR_MIX_CANVAS_RATIO_V1,
  );
}

export function brushColorMixDepositAmountV1(preset: BrushPresetV1): number {
  return brushColorMixUnitValueV1(
    preset.colorMix.depositAmount,
    DEFAULT_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1,
  );
}

export function withBrushColorMixEnabledV1(preset: BrushPresetV1, enabled: boolean): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush color mixing enabled flag must be boolean');
  if (enabled === DEFAULT_BRUSH_COLOR_MIX_ENABLED_V1) {
    const { enabled: _enabled, ...colorMix } = preset.colorMix;
    return normalizeBrushPresetV1({ ...preset, colorMix });
  }
  return normalizeBrushPresetV1({ ...preset, colorMix: { ...preset.colorMix, enabled } });
}

export function withBrushColorMixCanvasRatioV1(
  preset: BrushPresetV1,
  canvasRatio: number,
): BrushPresetV1 {
  if (!Number.isFinite(canvasRatio) || canvasRatio < 0 || canvasRatio > 1) {
    throw new RangeError('brush color mixing canvas ratio must be within 0..1');
  }
  if (canvasRatio === DEFAULT_BRUSH_COLOR_MIX_CANVAS_RATIO_V1) {
    const { canvasRatio: _canvasRatio, ...colorMix } = preset.colorMix;
    return normalizeBrushPresetV1({ ...preset, colorMix });
  }
  return normalizeBrushPresetV1({ ...preset, colorMix: { ...preset.colorMix, canvasRatio } });
}

export function withBrushColorMixDepositAmountV1(
  preset: BrushPresetV1,
  depositAmount: number,
): BrushPresetV1 {
  if (!Number.isFinite(depositAmount) || depositAmount < 0 || depositAmount > 1) {
    throw new RangeError('brush color mixing deposit amount must be within 0..1');
  }
  if (depositAmount === DEFAULT_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1) {
    const { depositAmount: _depositAmount, ...colorMix } = preset.colorMix;
    return normalizeBrushPresetV1({ ...preset, colorMix });
  }
  return normalizeBrushPresetV1({ ...preset, colorMix: { ...preset.colorMix, depositAmount } });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
)

replace_once(
    'src/gpu/baseline-brush.ts',
    "  readonly tipShape?: BaselineBrushTipShapeV1;\n  readonly color?: BaselineBrushColorV1;\n}\n\nexport function baselineDabColorV1",
    """  readonly tipShape?: BaselineBrushTipShapeV1;
  readonly color?: BaselineBrushColorV1;
  readonly colorMixEnabled?: boolean;
  readonly colorMixCanvasRatio?: number;
  readonly colorMixDepositAmount?: number;
}

export const BASELINE_BRUSH_COLOR_MIX_CANVAS_RATIO_V1 = 0.5 as const;
export const BASELINE_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1 = 1 as const;

export function baselineDabColorMixEnabledV1(dab: BaselineBrushDabV1): boolean {
  return dab.colorMixEnabled === true;
}

export function baselineDabColorMixCanvasRatioV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixCanvasRatio;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_CANVAS_RATIO_V1;
}

export function baselineDabColorMixDepositAmountV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixDepositAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1;
}

export function baselineDabColorV1""",
)

replace_once(
    'src/app/paint-session-controller.ts',
    "  readonly brushSprayAngleBasedOnCenter: boolean;\n  readonly brushTipAngleDegrees: number;\n",
    """  readonly brushSprayAngleBasedOnCenter: boolean;
  readonly brushColorMixEnabled: boolean;
  readonly brushColorMixCanvasRatio: number;
  readonly brushColorMixDepositAmount: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  #brushSprayAngleBasedOnCenter: boolean = BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n",
    """  #brushSprayAngleBasedOnCenter: boolean = BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1;
  #brushColorMixEnabled = false;
  #brushColorMixCanvasRatio = 0.5;
  #brushColorMixDepositAmount = 1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "      brushSprayAngleBasedOnCenter: this.#brushSprayAngleBasedOnCenter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n",
    """      brushSprayAngleBasedOnCenter: this.#brushSprayAngleBasedOnCenter,
      brushColorMixEnabled: this.#brushColorMixEnabled,
      brushColorMixCanvasRatio: this.#brushColorMixCanvasRatio,
      brushColorMixDepositAmount: this.#brushColorMixDepositAmount,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  brushSprayAngleBasedOnCenter(): boolean {\n    return this.#brushSprayAngleBasedOnCenter;\n  }\n\n  setBrushTipAngleDegrees",
    """  brushSprayAngleBasedOnCenter(): boolean {
    return this.#brushSprayAngleBasedOnCenter;
  }

  setBrushColorMix(enabled: boolean, canvasRatio: number, depositAmount: number): void {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime color mixing enabled flag');
    if (!Number.isFinite(canvasRatio) || canvasRatio < 0 || canvasRatio > 1) {
      throw new RangeError('invalid runtime color mixing canvas ratio');
    }
    if (!Number.isFinite(depositAmount) || depositAmount < 0 || depositAmount > 1) {
      throw new RangeError('invalid runtime color mixing deposit amount');
    }
    if (
      enabled !== this.#brushColorMixEnabled ||
      canvasRatio !== this.#brushColorMixCanvasRatio ||
      depositAmount !== this.#brushColorMixDepositAmount
    ) {
      this.#clearActiveStroke();
    }
    this.#brushColorMixEnabled = enabled;
    this.#brushColorMixCanvasRatio = canvasRatio;
    this.#brushColorMixDepositAmount = depositAmount;
  }

  brushColorMix(): Readonly<{ enabled: boolean; canvasRatio: number; depositAmount: number }> {
    return Object.freeze({
      enabled: this.#brushColorMixEnabled,
      canvasRatio: this.#brushColorMixCanvasRatio,
      depositAmount: this.#brushColorMixDepositAmount,
    });
  }

  setBrushTipAngleDegrees""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  if (color === null) throw new TypeError('invalid baseline dab color');\n  if (\n    radius <= 0 ||\n",
    """  if (color === null) throw new TypeError('invalid baseline dab color');
  const colorMixEnabled =
    value.colorMixEnabled === undefined ? undefined : value.colorMixEnabled;
  const colorMixCanvasRatio =
    value.colorMixCanvasRatio === undefined
      ? undefined
      : finiteNumber(value.colorMixCanvasRatio, 'baseline dab colorMixCanvasRatio');
  const colorMixDepositAmount =
    value.colorMixDepositAmount === undefined
      ? undefined
      : finiteNumber(value.colorMixDepositAmount, 'baseline dab colorMixDepositAmount');
  if (colorMixEnabled !== undefined && typeof colorMixEnabled !== 'boolean') {
    throw new TypeError('invalid baseline dab color mixing enabled flag');
  }
  if (
    (colorMixCanvasRatio !== undefined && (colorMixCanvasRatio < 0 || colorMixCanvasRatio > 1)) ||
    (colorMixDepositAmount !== undefined &&
      (colorMixDepositAmount < 0 || colorMixDepositAmount > 1))
  ) {
    throw new RangeError('invalid baseline dab color mixing range');
  }
  if (
    radius <= 0 ||
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "    ...(tipShape === undefined ? {} : { tipShape }),\n    ...(color === undefined ? {} : { color }),\n  });\n}\n",
    """    ...(tipShape === undefined ? {} : { tipShape }),
    ...(color === undefined ? {} : { color }),
    ...(colorMixEnabled === undefined ? {} : { colorMixEnabled }),
    ...(colorMixCanvasRatio === undefined ? {} : { colorMixCanvasRatio }),
    ...(colorMixDepositAmount === undefined ? {} : { colorMixDepositAmount }),
  });
}
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  activeDabs(): readonly BaselineBrushDabV1[] {\n    return this.#activeBrushStroke?.dabs() ?? Object.freeze([]);\n  }\n",
    """  activeDabs(): readonly BaselineBrushDabV1[] {
    const dabs = this.#activeBrushStroke?.dabs() ?? Object.freeze([]);
    return this.#resolvedColorMixDabs(dabs);
  }
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "        this.#completedStrokes.push(freezeCompletedStroke(completed, finalDabs));\n",
    """        this.#completedStrokes.push(
          freezeCompletedStroke(completed, this.#resolvedColorMixDabs(finalDabs)),
        );
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  #queueActiveDabDelta(delta: readonly BaselineBrushDabV1[]): void {\n    if (delta.length === 0) return;\n    if (this.#activeDabDelta.length === 0) {\n      this.#activeDabDelta = delta;\n      return;\n    }\n    this.#activeDabDelta = Object.freeze([...this.#activeDabDelta, ...delta]);\n  }\n\n  #clearActiveStroke(): void {\n",
    """  #resolvedColorMixDabs(dabs: readonly BaselineBrushDabV1[]): readonly BaselineBrushDabV1[] {
    if (!this.#brushColorMixEnabled || this.#brushMode !== 'raster' || dabs.length === 0) return dabs;
    return Object.freeze(
      dabs.map((dab) =>
        Object.freeze({
          ...dab,
          colorMixEnabled: true,
          colorMixCanvasRatio: this.#brushColorMixCanvasRatio,
          colorMixDepositAmount: this.#brushColorMixDepositAmount,
        }),
      ),
    );
  }

  #queueActiveDabDelta(delta: readonly BaselineBrushDabV1[]): void {
    if (delta.length === 0) return;
    const resolved = this.#resolvedColorMixDabs(delta);
    if (this.#activeDabDelta.length === 0) {
      this.#activeDabDelta = resolved;
      return;
    }
    this.#activeDabDelta = Object.freeze([...this.#activeDabDelta, ...resolved]);
  }

  #clearActiveStroke(): void {
""",
)

replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';\n",
    """import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';
import {
  decodeSrgbTransferComponentV1,
  encodeSrgbTransferComponentV1,
} from '../domain/color-management.js';
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  baselineDabColorV1,\n  baselineDabFlowV1,\n",
    """  baselineDabColorV1,
  baselineDabColorMixCanvasRatioV1,
  baselineDabColorMixDepositAmountV1,
  baselineDabColorMixEnabledV1,
  baselineDabFlowV1,
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "function rasterizeColorDab(\n",
    """function mixedDigitalBrushColorV1(
  brushColor: readonly [number, number, number],
  canvasColor: readonly [number, number, number],
  canvasAlpha: number,
  canvasRatio: number,
): readonly [number, number, number] {
  const effectiveCanvasRatio = clamp01(canvasRatio) * clamp01(canvasAlpha);
  if (effectiveCanvasRatio <= 0) return brushColor;
  if (effectiveCanvasRatio >= 1) return canvasColor;
  const brushWeight = 1 - effectiveCanvasRatio;
  return Object.freeze([
    clamp01(
      encodeSrgbTransferComponentV1(
        decodeSrgbTransferComponentV1(brushColor[0]) * brushWeight +
          decodeSrgbTransferComponentV1(canvasColor[0]) * effectiveCanvasRatio,
      ),
    ),
    clamp01(
      encodeSrgbTransferComponentV1(
        decodeSrgbTransferComponentV1(brushColor[1]) * brushWeight +
          decodeSrgbTransferComponentV1(canvasColor[1]) * effectiveCanvasRatio,
      ),
    ),
    clamp01(
      encodeSrgbTransferComponentV1(
        decodeSrgbTransferComponentV1(brushColor[2]) * brushWeight +
          decodeSrgbTransferComponentV1(canvasColor[2]) * effectiveCanvasRatio,
      ),
    ),
  ]);
}

function rasterizeColorDab(
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  const sourceColor = baselineDabColorV1(dab);\n  const flow = clamp01(baselineDabFlowV1(dab));\n",
    """  const sourceColor = baselineDabColorV1(dab);
  const colorMixEnabled = baselineDabColorMixEnabledV1(dab);
  const colorMixCanvasRatio = baselineDabColorMixCanvasRatioV1(dab);
  const colorMixDepositAmount = baselineDabColorMixDepositAmountV1(dab);
  const flow = clamp01(baselineDabFlowV1(dab));
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "  const sourceAlphaForPixel = (pixel: number, coverage: number): number => {\n    if (!semanticFlowOpacity || strokeCoverage === null) return clamp01(opacity * coverage);\n    const deposit = clamp01(flow * coverage);\n",
    """  const sourceAlphaForPixel = (pixel: number, coverage: number): number => {
    const depositedCoverage = coverage * (colorMixEnabled ? colorMixDepositAmount : 1);
    if (!semanticFlowOpacity || strokeCoverage === null) {
      return clamp01(opacity * depositedCoverage);
    }
    const deposit = clamp01(flow * depositedCoverage);
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "        const destinationBlue = (bytes[pixelOffset + 2] ?? 0) / 255;\n        const destinationWeight = destinationAlpha * inverseSourceAlpha;\n        const sourceWeight = sourceAlpha;\n        bytes[pixelOffset] = Math.round(\n          (outputAlpha > 0\n            ? (sourceColor[0] * sourceWeight + destinationRed * destinationWeight) / outputAlpha\n            : 0) * 255,\n        );\n        bytes[pixelOffset + 1] = Math.round(\n          (outputAlpha > 0\n            ? (sourceColor[1] * sourceWeight + destinationGreen * destinationWeight) / outputAlpha\n            : 0) * 255,\n        );\n        bytes[pixelOffset + 2] = Math.round(\n          (outputAlpha > 0\n            ? (sourceColor[2] * sourceWeight + destinationBlue * destinationWeight) / outputAlpha\n            : 0) * 255,\n        );\n",
    """        const destinationBlue = (bytes[pixelOffset + 2] ?? 0) / 255;
        const resolvedSourceColor = colorMixEnabled
          ? mixedDigitalBrushColorV1(
              sourceColor,
              [destinationRed, destinationGreen, destinationBlue],
              destinationAlpha,
              colorMixCanvasRatio,
            )
          : sourceColor;
        const destinationWeight = destinationAlpha * inverseSourceAlpha;
        const sourceWeight = sourceAlpha;
        bytes[pixelOffset] = Math.round(
          (outputAlpha > 0
            ? (resolvedSourceColor[0] * sourceWeight + destinationRed * destinationWeight) /
              outputAlpha
            : 0) * 255,
        );
        bytes[pixelOffset + 1] = Math.round(
          (outputAlpha > 0
            ? (resolvedSourceColor[1] * sourceWeight + destinationGreen * destinationWeight) /
              outputAlpha
            : 0) * 255,
        );
        bytes[pixelOffset + 2] = Math.round(
          (outputAlpha > 0
            ? (resolvedSourceColor[2] * sourceWeight + destinationBlue * destinationWeight) /
              outputAlpha
            : 0) * 255,
        );
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "      const destinationAlpha = destination[3];\n      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);\n      const destinationWeight = destinationAlpha * (1 - sourceAlpha);\n      writePixel(tile, pixel, [\n        outputAlpha > 0\n          ? (sourceColor[0] * sourceAlpha + destination[0] * destinationWeight) / outputAlpha\n          : 0,\n        outputAlpha > 0\n          ? (sourceColor[1] * sourceAlpha + destination[1] * destinationWeight) / outputAlpha\n          : 0,\n        outputAlpha > 0\n          ? (sourceColor[2] * sourceAlpha + destination[2] * destinationWeight) / outputAlpha\n          : 0,\n        outputAlpha,\n      ]);\n",
    """      const destinationAlpha = destination[3];
      const resolvedSourceColor = colorMixEnabled
        ? mixedDigitalBrushColorV1(
            sourceColor,
            [destination[0], destination[1], destination[2]],
            destinationAlpha,
            colorMixCanvasRatio,
          )
        : sourceColor;
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const destinationWeight = destinationAlpha * (1 - sourceAlpha);
      writePixel(tile, pixel, [
        outputAlpha > 0
          ? (resolvedSourceColor[0] * sourceAlpha + destination[0] * destinationWeight) /
            outputAlpha
          : 0,
        outputAlpha > 0
          ? (resolvedSourceColor[1] * sourceAlpha + destination[1] * destinationWeight) /
            outputAlpha
          : 0,
        outputAlpha > 0
          ? (resolvedSourceColor[2] * sourceAlpha + destination[2] * destinationWeight) /
            outputAlpha
          : 0,
        outputAlpha,
      ]);
""",
)

replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "  baselineDabColorV1,\n  baselineDabFlowV1,\n",
    """  baselineDabColorV1,
  baselineDabColorMixCanvasRatioV1,
  baselineDabColorMixDepositAmountV1,
  baselineDabColorMixEnabledV1,
  baselineDabFlowV1,
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "        ...(dab.color === undefined\n          ? {}\n          : { color: Object.freeze([...dab.color]) as readonly [number, number, number] }),\n      }),\n",
    """        ...(dab.color === undefined
          ? {}
          : { color: Object.freeze([...dab.color]) as readonly [number, number, number] }),
        ...(dab.colorMixEnabled === undefined ? {} : { colorMixEnabled: dab.colorMixEnabled }),
        ...(dab.colorMixCanvasRatio === undefined
          ? {}
          : { colorMixCanvasRatio: dab.colorMixCanvasRatio }),
        ...(dab.colorMixDepositAmount === undefined
          ? {}
          : { colorMixDepositAmount: dab.colorMixDepositAmount }),
      }),
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "    (dab.tipAngleDegrees === undefined || Number.isFinite(dab.tipAngleDegrees)) &&\n    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')\n",
    """    (dab.tipAngleDegrees === undefined || Number.isFinite(dab.tipAngleDegrees)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square') &&
    (dab.colorMixEnabled === undefined || typeof dab.colorMixEnabled === 'boolean') &&
    (dab.colorMixCanvasRatio === undefined ||
      (Number.isFinite(dab.colorMixCanvasRatio) &&
        dab.colorMixCanvasRatio >= 0 &&
        dab.colorMixCanvasRatio <= 1)) &&
    (dab.colorMixDepositAmount === undefined ||
      (Number.isFinite(dab.colorMixDepositAmount) &&
        dab.colorMixDepositAmount >= 0 &&
        dab.colorMixDepositAmount <= 1))
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&\n    baselineDabColorV1(left).every(\n      (component, index) => component === baselineDabColorV1(right)[index],\n    )\n",
    """    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
    baselineDabColorMixEnabledV1(left) === baselineDabColorMixEnabledV1(right) &&
    baselineDabColorMixCanvasRatioV1(left) === baselineDabColorMixCanvasRatioV1(right) &&
    baselineDabColorMixDepositAmountV1(left) === baselineDabColorMixDepositAmountV1(right) &&
    baselineDabColorV1(left).every(
      (component, index) => component === baselineDabColorV1(right)[index],
    )
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    "      baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY ||\n      (baselineDabUsesFlowOpacityV1(dab) &&\n",
    """      baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY ||
      baselineDabColorMixEnabledV1(dab) ||
      (baselineDabUsesFlowOpacityV1(dab) &&
""",
)

replace_once(
    'src/workers/render.worker.ts',
    "    const tipAngleDegrees = candidate.tipAngleDegrees;\n    if (\n",
    """    const tipAngleDegrees = candidate.tipAngleDegrees;
    const colorMixEnabled = candidate.colorMixEnabled;
    const colorMixCanvasRatio = candidate.colorMixCanvasRatio;
    const colorMixDepositAmount = candidate.colorMixDepositAmount;
    if (
""",
)
replace_once(
    'src/workers/render.worker.ts',
    "      (tipAngleDegrees !== undefined &&\n        (typeof tipAngleDegrees !== 'number' || !Number.isFinite(tipAngleDegrees)))\n    ) {\n",
    """      (tipAngleDegrees !== undefined &&
        (typeof tipAngleDegrees !== 'number' || !Number.isFinite(tipAngleDegrees))) ||
      (colorMixEnabled !== undefined && typeof colorMixEnabled !== 'boolean') ||
      (colorMixCanvasRatio !== undefined &&
        (typeof colorMixCanvasRatio !== 'number' ||
          !Number.isFinite(colorMixCanvasRatio) ||
          colorMixCanvasRatio < 0 ||
          colorMixCanvasRatio > 1)) ||
      (colorMixDepositAmount !== undefined &&
        (typeof colorMixDepositAmount !== 'number' ||
          !Number.isFinite(colorMixDepositAmount) ||
          colorMixDepositAmount < 0 ||
          colorMixDepositAmount > 1))
    ) {
""",
)
replace_once(
    'src/workers/render.worker.ts',
    "        ...(tipShape === undefined ? {} : { tipShape }),\n        ...(color === undefined ? {} : { color }),\n      }),\n",
    """        ...(tipShape === undefined ? {} : { tipShape }),
        ...(color === undefined ? {} : { color }),
        ...(colorMixEnabled === undefined ? {} : { colorMixEnabled }),
        ...(colorMixCanvasRatio === undefined ? {} : { colorMixCanvasRatio }),
        ...(colorMixDepositAmount === undefined ? {} : { colorMixDepositAmount }),
      }),
""",
)

replace_once(
    'src/app/brush-preset-library.ts',
    "  withBrushSprayAngleBasedOnCenterV1,\n  withBrushStrokeSpacingV1,\n",
    """  withBrushSprayAngleBasedOnCenterV1,
  withBrushColorMixEnabledV1,
  withBrushColorMixCanvasRatioV1,
  withBrushColorMixDepositAmountV1,
  withBrushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    "export function updateBrushPresetCustomTipV1(\n",
    """export function updateBrushPresetColorMixEnabledV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushColorMixEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 }),
      locked: item.locked,
    });
  });
}

export function updateBrushPresetColorMixCanvasRatioV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  canvasRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushColorMixCanvasRatioV1(item.preset, canvasRatio);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 }),
      locked: item.locked,
    });
  });
}

export function updateBrushPresetColorMixDepositAmountV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  depositAmount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushColorMixDepositAmountV1(item.preset, depositAmount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 }),
      locked: item.locked,
    });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

replace_once(
    'src/app/brush-preset-controller.ts',
    "  brushSprayAngleBasedOnCenterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n",
    """  brushSprayAngleBasedOnCenterV1,
  brushColorMixEnabledV1,
  brushColorMixCanvasRatioV1,
  brushColorMixDepositAmountV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  updateBrushPresetSprayAngleBasedOnCenterV1,\n  updateBrushPresetSpacingV1,\n",
    """  updateBrushPresetSprayAngleBasedOnCenterV1,
  updateBrushPresetColorMixEnabledV1,
  updateBrushPresetColorMixCanvasRatioV1,
  updateBrushPresetColorMixDepositAmountV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const sprayAngleBasedOnCenterButton = requireElement(\n    '#brush-spray-angle-based-on-center',\n    HTMLButtonElement,\n  );\n  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);\n",
    """  const sprayAngleBasedOnCenterButton = requireElement(
    '#brush-spray-angle-based-on-center',
    HTMLButtonElement,
  );
  const colorMixEnabledButton = requireElement('#brush-color-mix-enabled', HTMLButtonElement);
  const colorMixCanvasRatioRange = requireElement('#brush-color-mix-canvas-ratio-range', HTMLInputElement);
  const colorMixCanvasRatioNumber = requireElement('#brush-color-mix-canvas-ratio-number', HTMLInputElement);
  const colorMixDepositRange = requireElement('#brush-color-mix-deposit-range', HTMLInputElement);
  const colorMixDepositNumber = requireElement('#brush-color-mix-deposit-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(item.preset);\n    input.paintSession.setBrushSprayAngleBasedOnCenter(sprayAngleBasedOnCenter);\n    const tipAssets = brushTipAssetsV1(item.preset);\n",
    """    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(item.preset);
    input.paintSession.setBrushSprayAngleBasedOnCenter(sprayAngleBasedOnCenter);
    const colorMixEnabled = brushColorMixEnabledV1(item.preset);
    const colorMixCanvasRatio = brushColorMixCanvasRatioV1(item.preset);
    const colorMixDepositAmount = brushColorMixDepositAmountV1(item.preset);
    input.paintSession.setBrushColorMix(
      colorMixEnabled,
      colorMixCanvasRatio,
      colorMixDepositAmount,
    );
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    input.root.dataset.illustroBrushSprayAngleBasedOnCenter = String(sprayAngleBasedOnCenter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n",
    """    input.root.dataset.illustroBrushSprayAngleBasedOnCenter = String(sprayAngleBasedOnCenter);
    input.root.dataset.illustroBrushColorMixEnabled = String(colorMixEnabled);
    input.root.dataset.illustroBrushColorMixCanvasRatio = String(colorMixCanvasRatio);
    input.root.dataset.illustroBrushColorMixDepositAmount = String(colorMixDepositAmount);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(selected.preset);\n    sprayAngleBasedOnCenterButton.textContent = sprayAngleBasedOnCenter ? 'ON' : 'OFF';\n    sprayAngleBasedOnCenterButton.setAttribute('aria-pressed', String(sprayAngleBasedOnCenter));\n    tipShape.value = brushTipShapeV1(selected.preset);\n",
    """    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(selected.preset);
    sprayAngleBasedOnCenterButton.textContent = sprayAngleBasedOnCenter ? 'ON' : 'OFF';
    sprayAngleBasedOnCenterButton.setAttribute('aria-pressed', String(sprayAngleBasedOnCenter));
    const colorMixEnabled = brushColorMixEnabledV1(selected.preset);
    colorMixEnabledButton.textContent = colorMixEnabled ? 'ON' : 'OFF';
    colorMixEnabledButton.setAttribute('aria-pressed', String(colorMixEnabled));
    const colorMixCanvasRatio = brushColorMixCanvasRatioV1(selected.preset);
    const colorMixDepositAmount = brushColorMixDepositAmountV1(selected.preset);
    configurePair(
      colorMixCanvasRatioRange,
      colorMixCanvasRatioNumber,
      0,
      100,
      1,
      colorMixCanvasRatio * 100,
    );
    configurePair(
      colorMixDepositRange,
      colorMixDepositNumber,
      0,
      100,
      1,
      colorMixDepositAmount * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const sprayOrientationLabel = sprayEnabled && sprayAngleBasedOnCenter ? ' · CenterAngle' : '';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px",
    """    const sprayOrientationLabel = sprayEnabled && sprayAngleBasedOnCenter ? ' · CenterAngle' : '';
    const colorMixLabel = colorMixEnabled
      ? ` · Mix${Math.round(colorMixCanvasRatio * 100)}%/Deposit${Math.round(colorMixDepositAmount * 100)}%`
      : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "${spraySpreadLabel}${sprayOrientationLabel}`;\n",
    "${spraySpreadLabel}${sprayOrientationLabel}${colorMixLabel}`;\n",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      sprayAngleBasedOnCenterButton,\n      tipShape,\n",
    """      sprayAngleBasedOnCenterButton,
      colorMixEnabledButton,
      colorMixCanvasRatioRange,
      colorMixCanvasRatioNumber,
      colorMixDepositRange,
      colorMixDepositNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    sprayAngleBasedOnCenterButton.disabled = locked || !sprayEnabled;\n    pressureCurveEditor?.setDisabled(locked);\n",
    """    sprayAngleBasedOnCenterButton.disabled = locked || !sprayEnabled;
    colorMixCanvasRatioRange.disabled = locked || !colorMixEnabled;
    colorMixCanvasRatioNumber.disabled = locked || !colorMixEnabled;
    colorMixDepositRange.disabled = locked || !colorMixEnabled;
    colorMixDepositNumber.disabled = locked || !colorMixEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const onSprayAngleBasedOnCenter = (): void =>\n    mutate(() =>\n      updateBrushPresetSprayAngleBasedOnCenterV1(\n        state,\n        state.selectedPresetId,\n        !brushSprayAngleBasedOnCenterV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onTipShape = (): void => {\n",
    """  const onSprayAngleBasedOnCenter = (): void =>
    mutate(() =>
      updateBrushPresetSprayAngleBasedOnCenterV1(
        state,
        state.selectedPresetId,
        !brushSprayAngleBasedOnCenterV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onColorMixEnabled = (): void =>
    mutate(() =>
      updateBrushPresetColorMixEnabledV1(
        state,
        state.selectedPresetId,
        !brushColorMixEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateColorMixCanvasRatio = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixCanvasRatioV1(
        state,
        state.selectedPresetId,
        valuePercent / 100,
      ),
    );
  const updateColorMixDepositAmount = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixDepositAmountV1(
        state,
        state.selectedPresetId,
        valuePercent / 100,
      ),
    );
  const onColorMixCanvasRatioRange = (): void =>
    updateColorMixCanvasRatio(Number(colorMixCanvasRatioRange.value));
  const onColorMixCanvasRatioNumber = (): void =>
    updateColorMixCanvasRatio(Number(colorMixCanvasRatioNumber.value));
  const onColorMixDepositRange = (): void =>
    updateColorMixDepositAmount(Number(colorMixDepositRange.value));
  const onColorMixDepositNumber = (): void =>
    updateColorMixDepositAmount(Number(colorMixDepositNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  sprayAngleBasedOnCenterButton.addEventListener('click', onSprayAngleBasedOnCenter);\n  tipShape.addEventListener('change', onTipShape);\n",
    """  sprayAngleBasedOnCenterButton.addEventListener('click', onSprayAngleBasedOnCenter);
  colorMixEnabledButton.addEventListener('click', onColorMixEnabled);
  colorMixCanvasRatioRange.addEventListener('input', onColorMixCanvasRatioRange);
  colorMixCanvasRatioNumber.addEventListener('change', onColorMixCanvasRatioNumber);
  colorMixDepositRange.addEventListener('input', onColorMixDepositRange);
  colorMixDepositNumber.addEventListener('change', onColorMixDepositNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      sprayAngleBasedOnCenterButton.removeEventListener('click', onSprayAngleBasedOnCenter);\n      pressureCurveEditor?.dispose();\n",
    """      sprayAngleBasedOnCenterButton.removeEventListener('click', onSprayAngleBasedOnCenter);
      colorMixEnabledButton.removeEventListener('click', onColorMixEnabled);
      colorMixCanvasRatioRange.removeEventListener('input', onColorMixCanvasRatioRange);
      colorMixCanvasRatioNumber.removeEventListener('change', onColorMixCanvasRatioNumber);
      colorMixDepositRange.removeEventListener('input', onColorMixDepositRange);
      colorMixDepositNumber.removeEventListener('change', onColorMixDepositNumber);
      pressureCurveEditor?.dispose();
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-spray-angle-based-on-center">中心基準角度</label>
                <button id="brush-spray-angle-based-on-center" type="button" aria-pressed="false" title="各粒子の向きを散布中心からの径方向を基準にする" disabled>OFF</button>
                <span class="shell-brush-tip-kind">Orient</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
""",
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-spray-angle-based-on-center">中心基準角度</label>
                <button id="brush-spray-angle-based-on-center" type="button" aria-pressed="false" title="各粒子の向きを散布中心からの径方向を基準にする" disabled>OFF</button>
                <span class="shell-brush-tip-kind">Orient</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-color-mix-enabled">通常色混ぜ</label>
                <button id="brush-color-mix-enabled" type="button" aria-pressed="false" title="通常ブラシが下地の色を取り込みながら描画する">OFF</button>
                <span class="shell-brush-tip-kind">Mix</span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-color-mix-canvas-ratio-range">下地色比率</label>
                <input id="brush-color-mix-canvas-ratio-range" type="range" min="0" max="100" step="1" value="50" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-color-mix-canvas-ratio-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="50" aria-label="通常色混ぜの下地色比率" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-color-mix-deposit-range">描画色のせ量</label>
                <input id="brush-color-mix-deposit-range" type="range" min="0" max="100" step="1" value="100" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-color-mix-deposit-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="100" aria-label="通常色混ぜの描画色のせ量" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
""",
)

replace_once(
    'tests/unit/baseline-raster-tile-store.test.ts',
    "import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';\n",
    """import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';
""",
)
replace_once(
    'tests/unit/baseline-raster-tile-store.test.ts',
    "  it('keeps 16-bit-float document tiles at eight bytes per pixel', () => {\n",
    """  it('mixes ordinary paint with opaque canvas color in linear light', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    const colored = (
      strokeId: string,
      color: readonly [number, number, number],
      mix = false,
    ): void => {
      store.applyDabs('layer-a', strokeId, [
        Object.freeze({
          schema: 'illustro.baseline-brush-dab/1' as const,
          x: 32,
          y: 32,
          radius: 8,
          opacity: 1,
          color,
          ...(mix
            ? {
                colorMixEnabled: true,
                colorMixCanvasRatio: 0.5,
                colorMixDepositAmount: 1,
              }
            : {}),
        }),
      ]);
      store.finalize(strokeId);
    };
    colored('stroke-blue', [0, 0, 1]);
    colored('stroke-red-mix', [1, 0, 0], true);
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const pixel = readBaselineRasterTilePixelV1(tile!, 32 * 128 + 32);
    expect(pixel[0]).toBeCloseTo(0.735, 2);
    expect(pixel[1]).toBeCloseTo(0, 3);
    expect(pixel[2]).toBeCloseTo(0.735, 2);
    expect(pixel[3]).toBeCloseTo(1, 3);
  });

  it('does not mix transparent black into ordinary paint and honors deposit amount', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-mix-transparent', [
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: 32,
        y: 32,
        radius: 8,
        opacity: 1,
        color: Object.freeze([1, 0, 0] as const),
        colorMixEnabled: true,
        colorMixCanvasRatio: 1,
        colorMixDepositAmount: 0.25,
      }),
    ]);
    store.finalize('stroke-mix-transparent');
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const pixel = readBaselineRasterTilePixelV1(tile!, 32 * 128 + 32);
    expect(pixel[0]).toBeCloseTo(1, 3);
    expect(pixel[1]).toBeCloseTo(0, 3);
    expect(pixel[2]).toBeCloseTo(0, 3);
    expect(pixel[3]).toBeCloseTo(0.25, 2);
  });

  it('keeps 16-bit-float document tiles at eight bytes per pixel', () => {
""",
)

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    "## M6A spray particle-orientation boundary — 2026-09-03\n",
    """

## M6A ordinary raster color-mixing boundary — 2026-09-04

**AUTHORITATIVE for M6A-062.** Ordinary raster color mixing is a deterministic digital paint behavior, not physical pigment/fluid simulation. The M6A-062 production subset uses `colorMix.enabled`, `colorMix.canvasRatio` (`0..1`, default `0.5`) and `colorMix.depositAmount` (`0..1`, default `1`). The feature is inert unless enabled and applies only to ordinary Raster paint; Eraser, basic Smudge and Blur keep their existing operation semantics.

For each covered destination pixel, the brush color and the current canonical active-Raster-Layer pixel are mixed in linear-light RGB and converted back through the document RGB transfer function before the normal source-over deposit. `canvasRatio=0` means brush color only and `canvasRatio=1` means fully available canvas color. Canvas contribution is multiplied by destination alpha, so fully transparent pixels never inject hidden/black RGB into the brush color. `depositAmount` scales the per-dab deposited coverage before the existing flow/stroke-opacity accumulation rule and therefore composes with, rather than bypasses, normal opacity/flow semantics.

The resolved M6A-062 values are carried on canonical dabs so Render Worker, history/recovery and deterministic reconstruction do not depend on the currently selected preset. Because the existing additive WebGPU preview shader cannot sample the destination color, any dab with ordinary color mixing enabled uses the retained canonical Raster Tile preview/recomposition path; non-mixing paint remains on the existing fast path without changed output. M6A-063 remains responsible for sample/pickup radius, pickup amount, stateful carried color and drag/extension semantics; M6A-062 does not introduce a wet reservoir or physical paint simulation.
""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    "M6A-062 ordinary raster color mixing:未完了\nM6A-063 wet/smudge-style pickup:未完了\n",
    """M6A-062 ordinary raster color mixing:完了
再開メモ: M6A-062はcolorMix.enabled / canvasRatio / depositAmountを通常Raster paintへ接続した。canvasRatioは0..1（既定0.5）で現在のactive Raster Layer画素をdestination alphaで重み付けしてlinear-light RGB混色するため透明画素のhidden/black RGBを取り込まない。depositAmountは0..1（既定1）で既存flow/stroke-opacity accumulationの前にcoverageをscaleする。解決済み設定はcanonical dabへ保存されWorker/History/Recoveryで決定的に再生される。mix-enabled dabはdestination samplingが必要なためcanonical Raster Tile preview/recompositionへfallbackし、OFF時は既存GPU fast path/outputを維持する。sample/pickup radius・pickup amount・carried color・drag/extensionはM6A-063の責務として未実装のまま残す。次はM6A-063 wet/smudge-style pickupから再開する。
M6A-063 wet/smudge-style pickup:未完了
""",
)
